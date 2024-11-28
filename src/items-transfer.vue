<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import {
  readCollections,
  schemaSnapshot,
  schemaDiff,
  schemaApply,
  SchemaSnapshotOutput,
  readActivities,
  deleteItem,
  deleteItems as deleteItemsSdk,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";
import { sortBy, uniqBy } from "lodash";

import { initDirectusClients } from "./init-directus-clients";
import { nav } from "./path";
import Nav from "./nav.vue";
import { useExportImport } from "./useExportImport";
import {
  splitCollections,
  recordFromCollectionabl,
  mapFromCollectionabl,
  removeFields,
  createJsonFile,
  createLogMessage,
  logMessageTypes,
} from "./utils";
import { COLLECTION_HEADER, LAST_SYNC_HEADER } from "./const";

import type {
  Collection,
  ExportSchemaConfig,
  Activity,
  ActivitiesMap,
} from "./types";

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const tableLoading = ref(true);
const log = ref("");
const step = ref(0);
const clientA = ref<any>(null);
const clientB = ref<any>(null);
const userCollections = ref<Collection[]>([]);
const systemCollections = ref<Collection[]>([]);

const canApplySchema = ref<boolean | null>(null);
const schema = ref<SchemaSnapshotOutput | null>(null);
const schemaDiffResponce = ref<any>(null);

const collectionsMap = ref<any>(null);
const fieldsMap = ref<any>(null);
const relationsMap = ref<any>(null);

const activities = ref<ActivitiesMap>(new Map());
const activitiesDeletedItems = ref<ActivitiesMap>(new Map());

const search = ref<string | null>(null);
const collectionsSorted = computed(() => {
  const normalizedSearch = search.value?.toLowerCase();
  const result = sortBy(
    userCollections.value
      .map((collection) => {
        if (collectionsMap.value[collection.collection]?.last_sync_date) {
          return {
            ...collection,
            last_sync_date:
              collectionsMap.value[collection.collection].last_sync_date,
          };
        }

        return collection;
      })
      .filter(
        (collection) =>
          collection.meta.export_schema?.export &&
          collection.collection.toLowerCase().includes(normalizedSearch ?? "")
      ),
    ["meta.sort", "collection"]
  );

  return result;
});
const selected = ref<Collection[]>([]);
const collectionForConfirm = ref<Collection[]>([]);
watch(selected, (collections) => {
  console.log("selected watcher", selected.value);
  if (step.value === 0) {
    collectionForConfirm.value = collections;
  }
});

const { uploadFile, exportData, updateSyncDate } = useExportImport();

const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;

  const rawCollections = await client1.request(readCollections());
  const collections = splitCollections(rawCollections);

  schema.value = await client1.request(schemaSnapshot());
  schemaDiffResponce.value = await client2.request(
    schemaDiff(schema.value as SchemaSnapshotOutput)
  );

  if (schemaDiffResponce.value?.status === 204) {
    canApplySchema.value = false;
  } else {
    canApplySchema.value = true;
  }

  userCollections.value = collections.userCollections;
  console.log("userCollections: ", userCollections.value);
  systemCollections.value = collections.systemCollections;

  collectionsMap.value = recordFromCollectionabl(
    schema.value!.collections as any
  );
  fieldsMap.value = mapFromCollectionabl(schema.value!.fields as any);
  relationsMap.value = mapFromCollectionabl(schema.value!.relations as any);
  console.log("collectionsMap:", collectionsMap.value);
  console.log("fieldsMap:", fieldsMap.value);
  console.log("relationsMap:", relationsMap.value);

  const rawRemoteCollections = await client2.request(readCollections());
  const remoteCollections = splitCollections(rawRemoteCollections);
  let date = new Date();
  for (let element of remoteCollections.userCollections) {
    if (element.meta.imported_at) {
      if (collectionsMap.value[element.collection]) {
        collectionsMap.value[element.collection] = {
          ...collectionsMap.value[element.collection],
          last_sync_date: element.meta.imported_at,
        };
      }
      if (new Date(element.meta.imported_at) < date) {
        date = new Date(element.meta.imported_at);
      }
    }
  }
  console.log("date for sorting", date);

  const getFilter = (actions: string[], page: number = 1) => ({
    limit: 2000,
    page,
    filter: {
      action: {
        _in: actions,
      },
      timestamp: {
        _gte: date,
      },
    } as any,
  });

  let i = 1;

  let deletedActivities = await client1.request(
    readActivities(getFilter(["delete"]))
  );
  while (deletedActivities.length) {
    activitiesDeletedItems.value = proceccActivities(
      deletedActivities,
      activitiesDeletedItems.value
    );
    i++;
    deletedActivities = await client1.request(
      readActivities(getFilter(["delete"], i))
    );
  }
  i = 1;

  let activitiesResponse = await client1.request(
    readActivities(getFilter(["create", "update", "delete"]))
  );
  while (activitiesResponse.length) {
    activities.value = proceccActivities(activitiesResponse, activities.value);
    i++;
    activitiesResponse = await client1.request(
      readActivities(getFilter(["create", "update", "delete"], i))
    );
  }

  console.log("activities.value:", activities.value);
  console.log("activitiesDeletedItems.value:", activitiesDeletedItems.value);

  loading.value = false;
  tableLoading.value = false;
};

onMounted(() => {
  init();
});

function proceccActivities(newActivities: Activity[], activities = new Map()) {
  for (let element of newActivities) {
    const tmpMap = new Map(activities.get(element.collection) || []);
    tmpMap.set(element.item, {
      ...(tmpMap.get(element.item) || {}),
      [element.timestamp]: element,
    });
    activities.set(element.collection, tmpMap);
  }

  return activities;
}

async function uploadItems(collectionName: string, data: JSON) {
  const file = createJsonFile(data, collectionName);
  await uploadFile(collectionName, file, clientB.value);
}

async function deleteItems(collectionName: string) {
  if (!activitiesDeletedItems.value.has(collectionName)) return;
  const deletedItems = activitiesDeletedItems.value.get(collectionName)!;
  const allItems = activities.value.get(collectionName)!;
  const arrToDelete: string[] = [];
  for (let key of deletedItems.keys()) {
    if (allItems.has(key)) {
      const deleteActions = deletedItems.get(key)!;
      const deleteActionsDate = Object.keys(deleteActions);
      const deletionDate = deleteActionsDate[deleteActionsDate.length - 1];
      const actionsDate = Object.keys(allItems.get(key)!);
      if (actionsDate[actionsDate.length - 1] === deletionDate) {
        arrToDelete.push(key);
      }
    }
  }

  console.log("arrToDelete", arrToDelete);

  //@ts-ignore
  await clientB.value.request(deleteItemsSdk(collectionName, arrToDelete));
}

const handleExportClick = ref(async () => {
  const failedCollections = new Map();
  const textLog: string[] = [];
  const dataMap = new Map();

  for (let element of selected.value) {
    let originData = await exportData(element.collection);
    originData = removeFields(originData, ["user_created", "user_updated"]);
    const fieldsToRemove = element.meta.export_schema?.exclude_fields || [];
    console.log(
      "fieldsToRemove before export",
      element.collection,
      fieldsToRemove
    );

    const secureData = removeFields(originData, fieldsToRemove);

    dataMap.set(element.collection, {
      origin: originData,
      secure: secureData,
    });
  }

  for (let [collectionName, data] of dataMap.entries()) {
    try {
      console.log("data.secure", data.secure);
      await uploadItems(collectionName, data.secure);
      await deleteItems(collectionName);
      await updateSyncDate(collectionName, clientB.value);
    } catch (e) {
      failedCollections.set(collectionName, false);
      textLog.push(
        createLogMessage(
          logMessageTypes.error,
          `${collectionName} load faild ${e?.errors?.[0]?.message}`
        )
      );
    }
  }

  if (failedCollections.size === 0) {
    notificationsStore.add({
      type: "success",
      title: "Item successfully transferred",
      dialog: true,
    });
  }

  log.value = textLog.join("");
});

function updateModelValue(newValue) {
  const selectableTable =
    step.value === 0 ? collectionsSorted.value : collectionForConfirm.value;
  if (newValue.length === 0) {
    selected.value = newValue;
  } else if (newValue.length === selectableTable.length) {
    for (let element of newValue) {
      selectCollection(element);
    }
  }
}

function getExcludedFieldsFromConfig(
  collectionName: string,
  config: ExportSchemaConfig | undefined
) {
  const fieldsMap = new Map();
  if (config?.exclude_fields?.length) {
    fieldsMap.set(collectionName, config.exclude_fields);
  }
  config?.related_collections?.forEach((item) => {
    if (item.exclude_fields?.length) {
      fieldsMap.set(item.collection, item.exclude_fields);
    }
  });

  console.log("getExcludedFieldsFromConfig", fieldsMap);
  return fieldsMap;
}

function selectCollection(item: Collection) {
  let relatedCollections: Collection[] = [];
  if (step.value === 0) {
    const fieldsToRemove = getExcludedFieldsFromConfig(
      item.collection,
      item.meta.export_schema
    );
    relatedCollections = getRelatedCollection(item.collection);
    for (let element of relatedCollections) {
      if (fieldsToRemove.has(element.collection)) {
        element.meta.export_schema = {
          ...(element.meta.export_schema || {}),
          exclude_fields: [
            ...(element.meta.export_schema?.exclude_fields || []),
            ...fieldsToRemove.get(element.collection),
          ],
        } as ExportSchemaConfig;
      }
    }
  }
  console.log("relatedCollections", relatedCollections);
  console.log("selected.value before", selected.value);
  selected.value = uniqBy(
    [...selected.value, ...relatedCollections, item],
    "collection"
  );
  console.log("selected.value after", selected.value);
}

function handleItemSelect(event: { value: boolean; item: Collection }) {
  if (event.value) {
    tableLoading.value = true;
    selectCollection(event.item);
    tableLoading.value = false;
  } else {
    const tmp = [...selected.value].filter((value) => {
      return value.collection !== event.item.collection;
    });

    selected.value = tmp;
  }
}

function getRelatedCollection(collectionName: string) {
  const collection = collectionsMap.value[collectionName] as Collection;
  if (collection) {
    const collections: Collection[] = [];

    collection.meta.export_schema?.related_collections?.forEach((item) => {
      collectionsMap.value[item.collection] &&
        collections.push(collectionsMap.value[item.collection]);
    });

    console.log("getRelatedCollection: ", collectionName, collection);
    return collections;
  }
  console.log(
    "no collectionsMap.value: ",
    collectionName,
    collectionsMap.value
  );

  return [];
}

function handleTransferClick() {
  step.value = 1;
  console.log("selected.value", selected.value);
  console.log("collectionForConfirm.value", collectionForConfirm.value);
}
function handleReturnToSelectionClick() {
  step.value = 0;
}

const handleApplySchemaClick = ref(async () => {
  try {
    const result = await clientB.value.request(
      schemaApply(schemaDiffResponce.value)
    );

    notificationsStore.add({
      type: "success",
      title: "Change applied successfully",
      dialog: false,
    });
    canApplySchema.value = true;
  } catch (e) {
    console.error(e);
    notificationsStore.add({
      type: "error",
      title: "Error duiring apply",
      text: e?.errors?.[0]?.message,
      dialog: true,
    });
  }
});

function handleSelectChangedCollectionsClick() {
  for (let collectionName of activities.value?.keys() || []) {
    if (collectionsMap.value[collectionName]) {
      selectCollection(collectionsMap.value[collectionName]);
    }
  }
}
</script>

<template>
  <private-view title="Item transfer">
    <template v-slot:navigation>
      <Nav :activeItem="nav['item-transfer'].id" />
    </template>
    <div class="wrapper">
      <div>
        <div class="mb controls">
          <v-input
            v-model="search"
            class="searchInput"
            :autofocus="userCollections.length > 25"
            type="search"
            :placeholder="'Search collection'"
            :full-width="false"
            v-if="step === 0"
          >
            <template #prepend>
              <v-icon name="search" outline />
            </template>
            <template #append>
              <v-icon
                v-if="search"
                clickable
                class="clear"
                name="close"
                @click.stop="search = null"
              />
            </template>
          </v-input>
          <v-button @click="handleReturnToSelectionClick" v-if="step === 1"
            >Return to selection</v-button
          >
          <v-button @click="handleTransferClick" v-if="step === 0"
            >Transfer items</v-button
          >
          <v-button
            @click="handleExportClick"
            v-if="step === 1"
            :disabled="!selected.length"
            >Confirm Transfer</v-button
          >
        </div>
        <div class="mb controls" v-if="step === 0">
          <v-button @click="handleApplySchemaClick" :disabled="!canApplySchema"
            >Transfer schema</v-button
          >
          <v-button @click="handleSelectChangedCollectionsClick"
            >Select changed collections</v-button
          >
        </div>
        <v-textarea
          v-model="log"
          :disabled="true"
          v-if="step === 1 && log.length"
        />
        <h1 v-if="step === 1">Confirm collections</h1>
        <VTable
          :showSelect="'multiple'"
          :headers="[...COLLECTION_HEADER, LAST_SYNC_HEADER]"
          :items="step === 0 ? collectionsSorted : collectionForConfirm"
          :itemKey="'collection'"
          :modelValue="selected"
          :loading="tableLoading"
          @item-selected="handleItemSelect"
          @update:modelValue="updateModelValue"
        ></VTable>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.wrapper {
  margin: 24px 32px;
}

.mb {
  margin-bottom: 32px;
}

.searchInput {
  width: 100%;
}
.controls {
  display: flex;
  gap: 32px;
}
</style>
