import {
  readActivities,
} from "@directus/sdk";

import type {
  Collection as DirectusCollection
} from "@directus/shared/types";

export type ExportSchemaConfig = {
  export: boolean;
  exclude_fields?: string[];
  related_collections?: {
    collection: string;
    exclude_fields?: string[];
  }[];
}

export type Collection = DirectusCollection & {
  meta: {
    system?: boolean;
    export_schema?: ExportSchemaConfig;
    imported_at?: string;
  };
  last_sync_date?: string;
};

export type Activity = ReturnType<typeof readActivities> & {
  collection: string;
  item: string;
  timestamp: string;
}

export type ActivitiesMap = Map<string, Map<string, Activity[]>>;