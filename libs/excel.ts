import * as xlsx from 'xlsx';
import { github } from './github';
import { Repo } from './types';



export class Excel {
    filename = `star-ranking-${new Date().toISOString().slice(0, 10)}.xlsx`;

    async writeDataToXlsxFile() {
        const data = this.transformRepo()
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Top Repos');
        xlsx.writeFile(wb, this.filename);
        console.log(`writeFile: success ${this.filename}`);
    }

    private transformRepo() {
        return github.repoList.map((repo: Repo) => ({
            Name: repo.nameWithOwner,
            Link: repo.url,
            Description: repo.description && repo.description.length >= 2000
                ? repo.description.slice(0, 1997) + "..."
                : repo.description || "",
            PrimaryLanguage: repo?.primaryLanguage?.name || '',
            RepositoryTopics: repo.repositoryTopics ? repo.repositoryTopics.map((topic) => topic.name).join(',') : '',
            Stargazers: repo.stargazerCount,
            updatedAt: repo.updatedAt,
        }))
    }

}

export const excel = new Excel();
