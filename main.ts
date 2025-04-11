import { github } from './libs/github';
import { excel } from './libs/excel';
import assert from 'assert';


async function starRanking() {
  await github.topSync();
  await excel.writeDataToXlsxFile();
  await github.createOrUpdateFile()
}

const ENVS = ['TOKEN_OF_GITHUB'];

ENVS.forEach((env) => {
  assert(process.env[env], `${env} must be added`);
});

starRanking();

