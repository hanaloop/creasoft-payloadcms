import * as migration_20260409_155721_initial from './20260409_155721_initial'
import * as migration_20260806_051735 from './20260806_051735'
import * as migration_20260806_052151 from './20260806_052151'
import * as migration_20260807_021953 from './20260807_021953'
import * as migration_20260824_072147_docs_categories from './20260824_072147_docs_categories'

export const migrations = [
  {
    up: migration_20260409_155721_initial.up,
    down: migration_20260409_155721_initial.down,
    name: '20260409_155721_initial',
  },
  {
    up: migration_20260806_051735.up,
    down: migration_20260806_051735.down,
    name: '20260806_051735',
  },
  {
    up: migration_20260806_052151.up,
    down: migration_20260806_052151.down,
    name: '20260806_052151',
  },
  {
    up: migration_20260807_021953.up,
    down: migration_20260807_021953.down,
    name: '20260807_021953',
  },
  {
    up: migration_20260824_072147_docs_categories.up,
    down: migration_20260824_072147_docs_categories.down,
    name: '20260824_072147_docs_categories',
  },
]
