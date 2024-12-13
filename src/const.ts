export const EXPORT_DATE_COLLECTOIN_NAME =
  "directus-extension-schema-export_export-date";
export const EXPORT_DATE_COLLECTOIN_PARAMS = {
  collection: EXPORT_DATE_COLLECTOIN_NAME,
  schema: {
    comment: null,
    name: "directus-extension-schema-export_export-date",
    schema: "public",
  },
  meta: {
    accountability: "all",
    archive_app_filter: true,
    archive_field: null,
    archive_value: null,
    collapse: "open",
    collection: "directus-extension-schema-export_export-date",
    color: null,
    display_template: null,
    group: null,
    hidden: false,
    icon: null,
    item_duplication_fields: null,
    note: null,
    preview_url: null,
    singleton: false,
    sort: null,
    sort_field: null,
    translations: null,
    unarchive_value: null,
    versioning: false,
  },
  fields: [
    {
      field: "id",
      type: "string",
      schema: {
        is_primary_key: true,
        is_nullable: false,
      },
    },
    {
      field: "data_update_date",
      type: "string",
      schema: {},
    },
    {
      field: "last_sync_date",
      type: "string",
      schema: {},
    },
  ],
}

export const COLLECTION_TO_EXCLUDE_FROM_SCHEMA = {
  [EXPORT_DATE_COLLECTOIN_NAME]: true,
}

export const COLLECTION_HEADER = [
  { text: "", value: "icon" },
  {
    text: "Collection",
    value: "collection",
  },
];
export const LAST_SYNC_HEADER = { text: "Last sync date", value: "last_sync_date", width: '300' };