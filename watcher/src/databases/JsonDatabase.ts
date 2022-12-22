import { ChainName, coalesceChainId } from '@certusone/wormhole-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { DB_FILE, DB_LAST_BLOCK_FILE } from '../consts';
import { Database } from './Database';
import { DB, LastBlockByChain, VaasByBlock } from './types';

const ENCODING = 'utf8';
export class JsonDatabase extends Database {
  db: DB;
  lastBlockByChain: LastBlockByChain;
  dbFile: string;
  dbLastBlockFile: string;
  constructor() {
    super();
    this.db = {};
    this.lastBlockByChain = {};
    if (!process.env.DB_FILE) {
      this.logger.info(`no db file set, using default path=${DB_FILE}`);
    }
    if (!process.env.DB_LAST_BLOCK_FILE) {
      this.logger.info(`no db file set, using default path=${DB_LAST_BLOCK_FILE}`);
    }
    this.dbFile = DB_FILE;
    this.dbLastBlockFile = DB_LAST_BLOCK_FILE;
  }
  async loadDb(): Promise<DB> {
    try {
      const rawDb = readFileSync(this.dbFile, ENCODING);
      this.db = JSON.parse(rawDb);
      const rawLast = readFileSync(this.dbLastBlockFile, ENCODING);
      this.lastBlockByChain = JSON.parse(rawLast);
    } catch (e) {
      this.logger.warn('Failed to load DB, initiating a fresh one.');
      this.db = {};
    }
    return this.db;
  }
  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    const chainId = coalesceChainId(chain);
    const blockInfo = this.lastBlockByChain[chainId];
    if (blockInfo) {
      return blockInfo.split('/')[0];
    }
    return null;
  }
  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    const chainId = coalesceChainId(chain);
    const filteredVaasByBlock = Database.filterEmptyBlocks(vaasByBlock);
    if (Object.keys(filteredVaasByBlock).length) {
      this.db[chainId] = { ...(this.db[chainId] || {}), ...filteredVaasByBlock };
      writeFileSync(this.dbFile, JSON.stringify(this.db), ENCODING);
    }
    // this will always overwrite the "last" block, so take caution if manually backfilling gaps
    const blockInfos = Object.keys(vaasByBlock);
    if (blockInfos.length) {
      this.lastBlockByChain[chainId] = blockInfos[blockInfos.length - 1];
      writeFileSync(this.dbLastBlockFile, JSON.stringify(this.lastBlockByChain), ENCODING);
    }
  }
}