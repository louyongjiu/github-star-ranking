
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
    primaryLanguage: Language;
    updatedAt: string;
    stargazerCount: number; 
}

export interface Repo extends RepoBase {
    repositoryTopics: RepositoryTopic[];
}

export interface GithubTopRepoNode extends RepoBase {
    repositoryTopics: GithubRepositoryTopicConnection;
}

export interface QueryForTopRepository {
        pageInfo: {
            startCursor: string;
            endCursor: string;
            hasNextPage: boolean;
        };
        edges: Array<{
            node: GithubTopRepoNode;
        }>;

}

