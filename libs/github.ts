import { Octokit } from '@octokit/rest';
import { excel } from './excel';
import { QueryForStarredRepository, Repo, GithubRepositoryTopic, RepositoryTopic, QueryForTopRepository } from './types';
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

    async fullSync() {
        // @ts-ignore
        const limit = +process.env.FULLSYNC_LIMIT || 200;
        console.log(`Github: Start to get all starred repos, limit is ${limit}`);

        let cursor = '';
        let hasNextPage = true;
        const repoList = [];
        let round = 1;

        while (hasNextPage && repoList.length < limit) {
            const data = await this.getStarredRepoAfterCursorRetryable(cursor, githubTopicsFirst);
            repoList.push(
                ...this.transformGithubStarResponse(data),
            );
            hasNextPage = data.starredRepositories.pageInfo.hasNextPage;
            cursor = data.starredRepositories.pageInfo.endCursor;
            console.log(`Github: Get starred repos, round is ${round}, count is ${repoList.length}, cursor is ${cursor}, hasNextPage is ${hasNextPage}`);
            round++;
        }

        this.repoList = repoList;

        console.log(`Github: Get all starred repos success, count is ${this.repoList.length}`);
    }

    async topSync() {
        // @ts-ignore
        const limit = +process.env.FULLSYNC_LIMIT || 200;
        // @ts-ignore
        let stargazerCount = +process.env.STARS || 10000
        console.log(`Github: Start to get top repos, limit is ${limit}`);

        let cursor = null;
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

            const repoFilters = repos.filter((objA) => {
                const objB = repoList.find((objB) => objA.nameWithOwner === objB.nameWithOwner);
                return !objB || objA.nameWithOwner !== objB.nameWithOwner;
            });
            repoList.push(
                ...repoFilters,
            );
            hasNextPage = data.pageInfo.hasNextPage;
            console.log(`Github: Get top repos, round is ${round}, count is ${repoList.length}, cursor is ${cursor}, hasNextPage is ${hasNextPage}`);
            cursor = data.pageInfo.endCursor;
            if (repos.filter(repo => repo.nameWithOwner === end.nameWithOwner).length > 0) {
                break;
            }
            if (!hasNextPage) {
                cursor = null;
                const repo = repos.slice(-1)[0];
                stargazerCount = repo.stargazerCount;
            }
            round++;
        }

        this.repoList = repoList;

        console.log(`Github: Get all top repos success, count is ${this.repoList.length}`);
    }

    private transformGithubStarResponse(data: QueryForStarredRepository): Repo[] {
        return (data.starredRepositories.edges || []).map(({ node, starredAt }) => ({
            ...node,
            starredAt,
            repositoryTopics: (node?.repositoryTopics?.nodes || []).map(
                (o: GithubRepositoryTopic): RepositoryTopic => ({ name: o?.topic?.name })
            ),
        }))
    }

    private transformGithubTopResponse(data: QueryForTopRepository): Repo[] {
        return (data.edges || []).map(({ node }) => ({
            ...node,
            repositoryTopics: (node?.repositoryTopics?.nodes || []).map(
                (o: GithubRepositoryTopic): RepositoryTopic => ({ name: o?.topic?.name })
            ),
        }))
    }

    private async getStarredRepoAfterCursorRetryable(cursor: string, topicFirst: number) {
        return new Promise<QueryForStarredRepository>((resolve, reject) => {
            const operation: retry.RetryOperation = retry.operation({ retries: 5, factor: 2, minTimeout: 120000 });
            operation.attempt(async (retryCount) => {
                try {
                    resolve(await this.getStarredRepoAfterCursor(cursor, topicFirst))
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


    private async getStarredRepoAfterCursor(cursor: string, topicFirst: number) {
        const data = await this.client.graphql<{ viewer: QueryForStarredRepository }>(
            `
                query ($after: String, $topicFirst: Int) {
                    viewer {
                        starredRepositories(first: 100, after: $after) {
                            pageInfo {
                                startCursor
                                endCursor
                                hasNextPage
                            }
                            edges {
                                starredAt
                                node {
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
                after: cursor,
                topicFirst: topicFirst,
            },
        );

        return data.viewer;
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
