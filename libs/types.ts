
export interface RepositoryTopic {
    name: string;
}

export interface GithubRepositoryTopic  {
    topic: RepositoryTopic;
}

export interface GithubRepositoryTopicConnection  {
    nodes: GithubRepositoryTopic[];
}

export interface Language {
    name: string;
}

export interface RepoBase {
    nameWithOwner: string;
    url: string;
    description: string;
    starredAt: string;
    primaryLanguage: Language;
    updatedAt: string;
    stargazerCount: number; 
}

export interface Repo extends RepoBase {
    repositoryTopics: RepositoryTopic[];
}

export interface GithubStarRepoNode extends RepoBase {
    repositoryTopics: GithubRepositoryTopicConnection;
}

export interface QueryForStarredRepository {
    starredRepositories: {
        pageInfo: {
            startCursor: string;
            endCursor: string;
            hasNextPage: boolean;
        };
        edges: Array<{
            starredAt: string;
            node: GithubStarRepoNode;
        }>;
    };
}

export interface QueryForTopRepository {
        pageInfo: {
            startCursor: string;
            endCursor: string;
            hasNextPage: boolean;
        };
        edges: Array<{
            node: GithubStarRepoNode;
        }>;

}

