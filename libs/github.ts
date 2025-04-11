import { Octokit } from '@octokit/rest';
import { excel } from './excel';
import { Repo, GithubRepositoryTopic, RepositoryTopic, QueryForTopRepository } from './types';
import * as retry from 'retry';
import * as fs from 'fs';


// @ts-ignore
const githubTopicsFirst = +process.env.REPO_TOPICS_LIMIT || 50;

export class Github {
    private client: Octokit;

    constructor() {
        this.client = new Octokit({
            auth: process.env.TOKEN_OF_GITHUB,
        });
    }

    repoList: Repo[] = [];

    async topSync() {
        // @ts-ignore
        const limit = +process.env.FULLSYNC_LIMIT || 200;
        // @ts-ignore
        let stargazerCount = +process.env.STARS || 10000;
        console.log(`Github: Start to get top repos, limit is ${limit}, stars is ${stargazerCount}`);

        const cursor = null;
        let hasNextPage = true;
        const repoList: Repo[] = [];
        let round = 1;

        const ascString = 'sort:stars-asc'
        const descString = 'sort:stars-desc'

        const endString = `stars:>=${stargazerCount} ${descString}`
        const endData = await this.getTopRepoAfterCursorRetryable(cursor, githubTopicsFirst, endString);
        const end = this.transformGithubTopResponse(endData).slice(0, 1)[0];

        while (repoList.length < limit) {
            const queryString = `stars:>=${stargazerCount} ${ascString}`
            const data: QueryForTopRepository = await this.getTopRepoAfterCursorRetryable(cursor, githubTopicsFirst, queryString);
            const repos = this.transformGithubTopResponse(data);

            const repoFilters = repos.filter((repoNew) => {
                const repoOld = repoList.find((repoOld) => repoNew.nameWithOwner === repoOld.nameWithOwner);
                return !repoOld || repoNew.nameWithOwner !== repoOld.nameWithOwner;
            });
            repoList.push(
                ...repoFilters,
            );
            hasNextPage = data.pageInfo.hasNextPage;
            const repo = repos.slice(-1)[0];
            stargazerCount = repo.stargazerCount;
            console.log(`Github: Get top repos, round is ${round}, count is ${repoList.length}, stars is ${stargazerCount}, hasNextPage is ${hasNextPage}`);
            if (repos.find(repo => repo.nameWithOwner === end.nameWithOwner)) {
                break;
            }
            round++;
        }
        repoList.sort((a, b) => b.stargazerCount - a.stargazerCount);
        this.repoList = repoList;

        console.log(`Github: Get all top repos success, count is ${this.repoList.length}`);
    }

    private transformGithubTopResponse(data: QueryForTopRepository): Repo[] {
        return (data.edges || []).map(({ node }) => ({
            ...node,
            repositoryTopics: (node?.repositoryTopics?.nodes || []).map(
                (o: GithubRepositoryTopic): RepositoryTopic => ({ name: o?.topic?.name })
            ),
        }))
    }

    private async getTopRepoAfterCursorRetryable(cursor: string | null, topicFirst: number, queryString: string) {
        return new Promise<QueryForTopRepository>((resolve, reject) => {
            const operation: retry.RetryOperation = retry.operation({ retries: 5, factor: 2, minTimeout: 120000 });
            operation.attempt(async (retryCount) => {
                try {
                    resolve(await this.getTopRepoAfterCursor(cursor, topicFirst, queryString))
                } catch (err) {
                    // @ts-ignore
                    if (operation.retry(err)) {
                        console.log(`Github: retryCount ${retryCount} , error ${JSON.stringify(err)}`);
                        // console.log(`Rate limited, retrying in ${operation.timeouts()} ms`);
                    } else {
                        reject(err);
                    }

                }
            });
        });
    }

    private async getTopRepoAfterCursor(cursor: string | null, topicFirst: number, queryString: string) {
        const data = await this.client.graphql<{ search: QueryForTopRepository }>(
            `
            query GetTopRepositories($queryString: String!, $after: String, $topicFirst: Int) {
                search(query: $queryString, type: REPOSITORY, first: 100, after: $after) {
                  repositoryCount
                  pageInfo {
                    startCursor
                    endCursor
                    hasNextPage
                  }
                  edges {
                    node {
                      ... on Repository {
                        nameWithOwner
                        url
                        description
                        primaryLanguage {
                            name
                        }
                        repositoryTopics(first: $topicFirst) {
                            nodes {
                                topic {
                                    name
                                }
                            }
                        }
                        updatedAt
                        stargazerCount
                      }
                    }
                  }
                }
            }
            `,
            {
                queryString: queryString,
                after: cursor,
                topicFirst: topicFirst,
            },
        );

        return data.search;
    }


    async createOrUpdateFile() {
        // 将 xlsx 文件提交到仓库中
        const filename = excel.filename
        const fileContent = fs.readFileSync(`./${filename}`);
        const base64Data = fileContent.toString('base64');

        //@ts-ignore
        const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
        //@ts-ignore
        const branch = process.env.GITHUB_REF.split('/').slice(-1)[0];
        // console.log(`owner: ${owner} , repo: ${repo} , branch: ${branch}`);
        const octokit = new Octokit({ auth: process.env.TOKEN_OF_GITHUB });
        await octokit.repos.createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            branch: branch,
            path: `daily-star-ranking/${filename}`,
            content: base64Data,
            message: `Add ${filename}`
        });
        console.log(`uploadFile: success ${filename}`);
    }

}

export const github = new Github();
