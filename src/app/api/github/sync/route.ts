import { NextResponse } from 'next/server';
import { syncGitHubData } from '@/lib/github-sync';
import { saveCommunityEvent, saveDownloadStats } from '@/lib/db';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG || 'IvorySQL';
const GITHUB_REPO = process.env.GITHUB_REPO || 'IvorySQL/IvorySQL';

const summaryCache = new Map<string, string>();

async function fetchGitHubApi(endpoint: string) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'IvorySQL-Dashboard'
    },
    next: { revalidate: 0 }
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  return res.json();
}

async function translateToChinese(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const cacheKey = text.substring(0, 100);
  if (summaryCache.has(cacheKey)) {
    return summaryCache.get(cacheKey)!;
  }

  try {
    const truncatedText = text.substring(0, 1000);
    const encoded = encodeURIComponent(truncatedText);
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|zh`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'IvorySQL-Dashboard'
      }
    });

    if (!res.ok) {
      return text;
    }

    const data = await res.json();
    let translated = data.responseData?.translatedText || text;
    
    if (translated && translated.length > 0) {
      translated = translated.trim();
    } else {
      return text;
    }
    
    summaryCache.set(cacheKey, translated);
    if (summaryCache.size > 500) {
      const firstKey = summaryCache.keys().next().value;
      if (firstKey) summaryCache.delete(firstKey);
    }
    
    return translated;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

export async function POST() {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
  }

  try {
    const result = await syncGitHubData();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const [owner, repo] = GITHUB_REPO.split('/');
    
    const [issuesData, prsData] = await Promise.all([
      fetchGitHubApi(`/repos/${owner}/${repo}/issues?state=open&per_page=20&sort=updated`),
      fetchGitHubApi(`/repos/${owner}/${repo}/pulls?state=open&per_page=20&sort=updated`)
    ]);

    const issues = issuesData.filter((i: any) => !i.pull_request);
    const pulls = prsData;

    const summaryPromises: Promise<void>[] = [];

    for (const issue of issues.slice(0, 10)) {
      const title = issue.title || '';
      const originalDescription = issue.body?.substring(0, 300) || '';
      const combinedText = title + ' ' + originalDescription;
      
      summaryPromises.push(
        translateToChinese(combinedText).then(async summary => {
          await saveCommunityEvent({
            date: issue.created_at.split('T')[0],
            source: 'github',
            title: issue.title,
            description: summary,
            url: issue.html_url,
            event_type: 'github_issue'
          });
        })
      );
    }

    for (const pr of pulls.slice(0, 10)) {
      const title = pr.title || '';
      const originalDescription = pr.body?.substring(0, 300) || '';
      const combinedText = title + ' ' + originalDescription;
      
      summaryPromises.push(
        translateToChinese(combinedText).then(async summary => {
          await saveCommunityEvent({
            date: pr.created_at.split('T')[0],
            source: 'github',
            title: pr.title,
            description: summary,
            url: pr.html_url,
            event_type: 'github_pr'
          });
        })
      );
    }

    await Promise.all(summaryPromises);

    // Record download stats
    try {
      const today = new Date().toISOString().split('T')[0];
      const [ghRes, dockerRes] = await Promise.all([
        fetch(`https://api.github.com/repos/IvorySQL/IvorySQL/releases?per_page=100`, {
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'IvorySQL' }
        }),
        fetch('https://hub.docker.com/v2/repositories/ivorysql/?page_size=50')
      ]);

      let githubDownloads = 0;
      if (ghRes.ok) {
        const releases = await ghRes.json();
        for (const r of (releases || [])) {
          for (const a of (r.assets || [])) {
            githubDownloads += a.download_count || 0;
          }
        }
      }

      let dockerPulls = 0;
      if (dockerRes.ok) {
        const docker = await dockerRes.json();
        for (const r of (docker.results || [])) {
          dockerPulls += r.pull_count || 0;
        }
      }

      await saveDownloadStats(today, githubDownloads, dockerPulls);
      console.log(`Download stats: GitHub=${githubDownloads}, Docker=${dockerPulls}`);
    } catch (e) {
      console.error('Failed to record download stats:', e);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub sync error:', error);
    return NextResponse.json({ error: 'Failed to sync GitHub data' }, { status: 500 });
  }
}

export async function GET() {
  // Lightweight cron sync: only update stars/forks from main repo
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
  }
  try {
    const [owner, repo] = GITHUB_REPO.split('/');
    const repoRes = await fetchGitHubApi(`/repos/${owner}/${repo}`);
    const today = new Date().toISOString().split('T')[0];

    const { saveGitHubStats } = await import('@/lib/db');
    await saveGitHubStats({
      date: today,
      stars: repoRes.stargazers_count || 0,
      forks: repoRes.forks_count || 0,
      watchers: repoRes.watchers_count || 0,
      subscribers: repoRes.subscribers_count || 0,
      open_issues: repoRes.open_issues_count || 0,
      open_prs: 0,
      contributors: 0,
      releases_count: 0
    });

    return NextResponse.json({
      success: true,
      stars: repoRes.stargazers_count,
      forks: repoRes.forks_count,
      mode: 'lightweight'
    });
  } catch (error: any) {
    console.error('GitHub cron sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
