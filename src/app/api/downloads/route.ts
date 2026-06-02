import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const results: any = {
    github: { total: 0, releases: [] as any[] },
    docker: { total: 0, repos: [] as any[] },
    mirror: null,
  };

  try {
    // GitHub Releases
    let githubTotal = 0;
    const ghReleases: any[] = [];

    if (token) {
      for (let page = 1; page <= 5; page++) {
        const ghRes = await fetch(
          `https://api.github.com/repos/IvorySQL/IvorySQL/releases?per_page=50&page=${page}`,
          { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'IvorySQL-Dashboard' } }
        );
        if (!ghRes.ok) break;

        const releases = await ghRes.json();
        if (!Array.isArray(releases) || releases.length === 0) break;

        for (const r of releases) {
          let releaseDownloads = 0;
          const assets: any[] = [];
          for (const a of (r.assets || [])) {
            assets.push({ name: a.name, downloads: a.download_count });
            releaseDownloads += a.download_count || 0;
          }
          githubTotal += releaseDownloads;
          ghReleases.push({
            tag: r.tag_name,
            date: r.published_at?.split('T')[0],
            total: releaseDownloads,
            assets,
          });
        }
      }
    }
    results.github = { total: githubTotal, releases: ghReleases };

    // Docker Hub
    const dockerRes = await fetch('https://hub.docker.com/v2/repositories/ivorysql/?page_size=50');
    if (dockerRes.ok) {
      const dockerData = await dockerRes.json();
      let dockerTotal = 0;
      const dockerRepos: any[] = [];
      for (const repo of (dockerData.results || [])) {
        dockerRepos.push({ name: repo.name, pulls: repo.pull_count });
        dockerTotal += repo.pull_count || 0;
      }
      results.docker = { total: dockerTotal, repos: dockerRepos };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
