<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import {
  readCollections,
  readActivities,
  deleteItems as deleteItemsSdk,
  readCollection,
  createCollection,
  readItems,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";
import { sortBy } from "lodash";

import { initDirectusClients } from "./init-directus-clients";
import { nav } from "./path";
import Nav from "./nav.vue";
import { useExportImport } from "./useExportImport";
import { useSchema } from "./useSchema";
import {
  splitCollections,
  removeFields,
  createJsonFile,
  createLogMessage,
  logMessageTypes,
} from "./utils";
import {
  COLLECTION_HEADER,
  EXPORT_DATE_COLLECTOIN_NAME,
  EXPORT_DATE_COLLECTOIN_PARAMS,
  LAST_SYNC_HEADER,
} from "./const";

import type {
  Collection,
  ExportSchemaConfig,
  Activity,
  ActivitiesMap,
  ExportElement,
  ExportDateCollection,
} from "./types";

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const transferProcessing = ref(false);
const tableLoading = ref(true);
const log = ref("");
const step = ref(0);
const clientA = ref<any>(null);
const clientB = ref<any>(null);
const userCollections = ref<Collection[]>([]);
const systemCollections = ref<Collection[]>([]);

const schema = ref<Awaited<ReturnType<typeof useSchema>> | null>(null);

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

const { uploadFile, exportData } = useExportImport();

const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;
  await checkExportDateCollection();
  requestInitData();
};

async function checkExportDateCollection() {
  try {
    const exportDateCollection = await clientB.value.request(
      readCollection(EXPORT_DATE_COLLECTOIN_NAME)
    );

    console.log(exportDateCollection);
  } catch (e) {
    await clientB.value.request(
      createCollection(EXPORT_DATE_COLLECTOIN_PARAMS)
    );
  }
}

async function requestInitData() {
  const COLLECTION_PER_REQUEST = 75;
  const ACTIVITIES_PER_REQUEST = 2000;

  loading.value = true;
  tableLoading.value = true;

  // getting collections from current Directus Client
  const rawCollections = await clientA.value.request(readCollections());
  const collections = splitCollections(rawCollections);
  userCollections.value = collections.userCollections;
  console.log("current Directus userCollections: ", userCollections.value);
  systemCollections.value = collections.systemCollections;

  // getting schema and sort it to collections, fields and relations
  schema.value = await useSchema(clientA.value, clientB.value);
  collectionsMap.value = schema.value.collectionsRecord;
  fieldsMap.value = schema.value.fieldsMap;
  relationsMap.value = schema.value.relationsMap;
  console.log("collectionsMap:", collectionsMap.value);
  console.log("fieldsMap:", fieldsMap.value);
  console.log("relationsMap:", relationsMap.value);

  const remoteExportDateCollection: ExportDateCollection[] =
    await clientB.value.request(
      readItems<any, any, any>(EXPORT_DATE_COLLECTOIN_NAME, {
        limit: -1,
      })
    );
  console.log(
    `collection in ${EXPORT_DATE_COLLECTOIN_NAME} on remote directus: `,
    remoteExportDateCollection
  );

  const collectionSelections: any[][] = [];
  let tmpCollectionSelections: any[] = [];
  let collectionCount = 0;
  for (let element of remoteExportDateCollection) {
    if (element.last_sync_date) {
      if (collectionsMap.value[element.id]) {
        collectionsMap.value[element.id] = {
          ...collectionsMap.value[element.id],
          last_sync_date: element.last_sync_date,
        };
        // divide into groups
        if (collectionCount >= COLLECTION_PER_REQUEST) {
          collectionSelections.push(tmpCollectionSelections);
          tmpCollectionSelections = [];
          collectionCount = 0;
        }
        tmpCollectionSelections.push({
          _and: [
            {
              collection: {
                _eq: element.id,
              },
            },
            {
              timestamp: {
                _gte: element.last_sync_date,
              },
            },
          ],
        });
        collectionCount++;
      }
    }
  }
  collectionSelections.push(tmpCollectionSelections);

  const getFilter = (actions: string[], part: number = 0, page: number = 1) => {
    const filterObj = {
      limit: ACTIVITIES_PER_REQUEST,
      page,
      filter: {
        _and: [
          {
            action: {
              _in: actions,
            },
          },
          { _or: collectionSelections[part] },
        ],
      } as any,
    };

    return filterObj;
  };

  console.log("chunks collection selections: ", collectionSelections);

  for (let j = 0; j < collectionSelections.length; j++) {
    let i = 1;
    let deletedActivities = await clientA.value.request(
      readActivities(getFilter(["delete"], j))
    );
    while (deletedActivities.length === ACTIVITIES_PER_REQUEST) {
      activitiesDeletedItems.value = proceccActivities(
        deletedActivities,
        activitiesDeletedItems.value
      );
      i++;
      deletedActivities = await clientA.value.request(
        readActivities(getFilter(["delete"], j, i))
      );
    }
    i = 1;

    let activitiesResponse = await clientA.value.request(
      readActivities(getFilter(["create", "update", "delete"], j))
    );
    while (activitiesResponse.length === ACTIVITIES_PER_REQUEST) {
      activities.value = proceccActivities(
        activitiesResponse,
        activities.value
      );
      i++;
      activitiesResponse = await clientA.value.request(
        readActivities(getFilter(["create", "update", "delete"], j, i))
      );
    }
  }

  console.log("activities.value:", activities.value);
  console.log("activitiesDeletedItems.value:", activitiesDeletedItems.value);

  loading.value = false;
  tableLoading.value = false;
}
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
  transferProcessing.value = true;
  const failedCollections = new Map();
  const textLog: string[] = [];
  const dataMap = new Map();
  const dateSyncJson: Partial<ExportDateCollection>[] = [];
  const date = new Date();

  for (let item of selected.value) {
    console.log(
      "collection to transfer",
      item,
      collectionsMap.value[item.collection]
    );
    for (let element of collectionsMap.value[item.collection].exportOrder ||
      []) {
      let originData;
      try {
        originData = await exportData(element.collection);
        if (originData.errors) {
          const e = new Error();
          //@ts-ignore
          e.errors = originData.errors;
          throw e;
        }
      } catch (e) {
        console.error(e);
        textLog.push(
          createLogMessage(
            logMessageTypes.error,
            `originData ${element.collection} load faild ${
              e?.errors?.[0]?.message || ""
            }`
          )
        );
        continue;
      }

      originData = removeFields(originData, ["user_created", "user_updated"]);
      const fieldsToRemove = element?.exclude_fields || [];
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
        // await updateSyncDate(collectionName, clientB.value, true);
        dateSyncJson.push({
          id: collectionName,
          data_update_date: date,
          last_sync_date: date,
        });
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

    // Update sync date of all unchanged collections
    // const unchangedSync = await Promise.allSettled(
    Object.keys(collectionsMap.value).map((collectionName) => {
      if (!activities.value.has(collectionName)) {
        // return updateSyncDate(collectionName, clientB.value);
        dateSyncJson.push({
          id: collectionName,
          last_sync_date: date,
        });
      }
    });
    // );

    console.log(
      `data to update ${EXPORT_DATE_COLLECTOIN_NAME}: `,
      dateSyncJson
    );
    // update EXPORT_DATE_COLLECTOIN_NAME with new Dates
    await uploadItems(
      EXPORT_DATE_COLLECTOIN_NAME,
      dateSyncJson as unknown as JSON
    );
    // Update initial data
    await requestInitData();
    transferProcessing.value = false;

    if (failedCollections.size === 0) {
      notificationsStore.add({
        type: "success",
        title: "Item successfully transferred",
        dialog: true,
      });
    }
    log.value = textLog.join("");
  }
});

function updateModelValue(newValue) {
  const selectableTable =
    step.value === 0 ? collectionsSorted.value : collectionForConfirm.value;
  if (newValue.length === 0) {
    selected.value = newValue;
  } else if (newValue.length === selectableTable.length) {
    selected.value = [];
    for (let element of newValue) {
      selectCollection(element);
    }
  }
}

function traversalExportTree(
  collectionName: string,
  config: ExportElement,
  order: ExportElement[] = []
): ExportElement[] {
  for (let element of config?.referenced_collections || []) {
    order.push(...traversalExportTree(element.collection, element));
  }
  order.push({
    collection: collectionName,
    exclude_fields: config?.exclude_fields || [],
  });
  for (let element of config?.related_collections || []) {
    order.push(...traversalExportTree(element.collection, element));
  }

  return order;
}

function selectCollection(item: Collection) {
  selected.value = [...selected.value, item];
  if (!collectionsMap.value[item.collection]?.exportOrder) {
    collectionsMap.value[item.collection].exportOrder = traversalExportTree(
      item.collection,
      item.meta.export_schema!
    );
    console.log(
      "first calculation of export order",
      item.meta.export_schema,
      collectionsMap.value[item.collection].exportOrder
    );
  }
}

function handleItemSelect(event: { value: boolean; item: Collection }) {
  if (event.value) {
    selectCollection(event.item);
  } else {
    const tmp = [...selected.value].filter((value) => {
      return value.collection !== event.item.collection;
    });

    selected.value = tmp;
  }
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
  if (schema.value) {
    try {
      await schema.value.applySchema();

      notificationsStore.add({
        type: "success",
        title: "Change applied successfully",
        dialog: false,
      });
      schema.value.canApply = true;
    } catch (e) {
      console.error(e);
      notificationsStore.add({
        type: "error",
        title: "Error duiring apply",
        text: e?.errors?.[0]?.message,
        dialog: true,
      });
    }
  } else {
    throw new Error("apply schema before init data");
  }
});

function handleSelectChangedCollectionsClick() {
  for (let collectionName of activities.value?.keys() || []) {
    const collection = collectionsMap.value[collectionName] as Collection;
    if (collection && collection.meta.export_schema?.export) {
      selectCollection(collection);
    }
  }
}
</script>

<template>
  <private-view title="Collection transfer">
    <template v-slot:navigation>
      <Nav :activeItem="nav['collection-transfer'].id" />
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
          <v-button
            @click="handleReturnToSelectionClick"
            v-if="step === 1"
            :loading="loading"
            >Return to selection</v-button
          >
          <v-button
            @click="handleTransferClick"
            v-if="step === 0"
            :disabled="!selected.length"
            :loading="loading"
            >Transfer collections</v-button
          >
          <v-button
            @click="handleExportClick"
            :loading="transferProcessing"
            v-if="step === 1"
            :disabled="!selected.length"
            >Confirm Transfer</v-button
          >
        </div>
        <div class="mb controls" v-if="step === 0">
          <v-button
            @click="handleApplySchemaClick"
            :disabled="!schema?.canApply"
            >Transfer schema</v-button
          >
          <v-button
            @click="handleSelectChangedCollectionsClick"
            :loading="loading"
          >
            Select changed collections
          </v-button>
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
          :loading="tableLoading || transferProcessing"
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
