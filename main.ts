import { github } from './libs/github';
import { Repo } from './libs/types';
import assert from 'assert';
import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { Octokit } from '@octokit/rest';

const filename = `star-ranking-${new Date().toISOString().slice(0, 10)}.xlsx`;

// 将获取到的仓库数据写入 xlsx 文件
async function writeDataToXlsxFile(data: any[]) {
  const header = ['Name', 'Link', 'Description', 'stargazerCount'];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data, { header });

  xlsx.utils.book_append_sheet(wb, ws, 'Top Repos');

  xlsx.writeFile(wb, filename);
}

async function starRanking() {
  await github.fullSync();

  const topRepos = github.repoList.map((repo: Repo) => ({
    Name: repo.nameWithOwner,
    Link: repo.url,
    Description: repo.description && repo.description.length >= 2000
      ? repo.description.slice(0, 1997) + "..."
      : repo.description || "",
    PrimaryLanguage: repo?.primaryLanguage?.name || '',
    RepositoryTopics: repo.repositoryTopics ? repo.repositoryTopics.map((topic) => topic.name).join(',') : '',
    StarredAt: repo.starredAt,
    Stargazers: repo.stargazerCount,
  }));

  await writeDataToXlsxFile(topRepos);

  // 将 xlsx 文件提交到仓库中
  const fileContent = fs.readFileSync(`./${filename}`);
  const base64Data = fileContent.toString('base64');

  console.log(`repository: ${process.env.GITHUB_REPOSITORY} , branch: ${process.env.GITHUB_REF}`);
  //@ts-ignore
  const { owner, repo } = process.env.GITHUB_REPOSITORY.split('/');
  //@ts-ignore
  const branch = process.env.GITHUB_REF.split('/').slice(-1)[0];

  const octokit = new Octokit({ auth: process.env.TOKEN_OF_GITHUB });
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    branch,
    path: filename,
    content: base64Data,
    message: `Add ${filename}`
  });
}

const ENVS = ['TOKEN_OF_GITHUB'];

ENVS.forEach((env) => {
  assert(process.env[env], `${env} must be added`);
});

starRanking();

