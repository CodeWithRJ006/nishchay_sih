import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from './seed.js';

runMigrations();
seedDemoData();
