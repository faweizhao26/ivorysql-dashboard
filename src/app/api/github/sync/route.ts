import { NextResponse } from 'next/server';
import { syncGitHubData } from '@/lib/github-sync';
import { saveCommunityEvent } from '@/lib/db';
import { runTrackedSync } from '@/lib/tracked-sync';
import { recordDownloadSnapshot } from '@/lib/download-stats';
import { getBeijingDate } from '@/lib/date';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'IvorySQL/IvorySQL';

const summaryCache = new Map<string, string>();

interface GitHubEventItem {
  title: string;
  body?: string | null;
  created_at: string;
  html_url: string;
  pull_request?: unknown;
}

async function fetchGitHubApi<T = unknown>(endpoint: string): Promise<T> {
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

  return res.json() as Promise<T>;
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
    const tracked = await runTrackedSync({ platform: 'github', trigger: 'manual' }, async () => {
      const result = await syncGitHubData();

      if (!result.success) throw new Error(result.error || 'GitHub sync failed');

      const [owner, repo] = GITHUB_REPO.split('/');
    
      const [issuesData, prsData] = await Promise.all([
        fetchGitHubApi<GitHubEventItem[]>(`/repos/${owner}/${repo}/issues?state=open&per_page=20&sort=updated`),
        fetchGitHubApi<GitHubEventItem[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=20&sort=updated`)
      ]);

      const issues = issuesData.filter(i => !i.pull_request);
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

      await recordDownloadSnapshot(getBeijingDate());

      const count = summaryPromises.length + 2;
      return { value: result, recordsSeen: count, recordsWritten: count };
    });
    return NextResponse.json({ ...tracked.value, runId: tracked.runId });
  } catch (error) {
    console.error('GitHub sync error:', error);
    return NextResponse.json({ error: 'Failed to sync GitHub data' }, { status: 500 });
  }
}

export async function GET() {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
  }
  try {
    const tracked = await runTrackedSync({ platform: 'github', trigger: 'vercel_cron' }, async () => {
      const today = getBeijingDate();
      const result = await syncGitHubData();
      if (!result.success) throw new Error(result.error || 'GitHub sync failed');
      await recordDownloadSnapshot(today);
      return { value: result, recordsSeen: 2, recordsWritten: 2 };
    });
    return NextResponse.json({
      success: true,
      ...tracked.value.data,
      mode: 'full',
      runId: tracked.runId,
    });
  } catch (error) {
    console.error('GitHub cron sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
