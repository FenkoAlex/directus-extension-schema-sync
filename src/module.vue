<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { merge, sortBy } from "lodash";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { useStores } from "@directus/extensions-sdk";
import {
  createDirectus,
  rest,
  graphql,
  authentication,
  readItems,
  readCollections,
  schemaSnapshot,
  schemaDiff,
  schemaApply,
} from "@directus/sdk";
import {
  Collection as DirectusCollection,
  Field,
  Relation,
} from "@directus/shared/types";

import CollectionItem from './collection-item.vue';
import { array } from "zod";
import { res } from "pino-std-serializers";

// useNotificationsStore
const envConfig = {
  stageDirectus: {
    name: "Stage Directus 1",
    url: "http://0.0.0.0:8055",
    login: "admin@example.com",
    password: "testTest",
    accessToken: "9BuaRepozAKYNbabCzCksK4J_TaH-NdU",
  },
  prodDirectus: {
    name: "Prod Directus 2",
    url: "http://0.0.0.0:8056",
    login: "admin@example.com",
    password: "testTest",
    accessToken: "CY0JlvXCPyotXyPOjsg564RJGFQ3_y65",
  },
};

export type Collection = DirectusCollection & {
  meta: {
    system?: boolean;
  };
};

export type CollectionTree = {
  collection: string;
  visible: boolean;
  children: CollectionTree[];
  search: string | null;
  findChild(collection: string): CollectionTree | undefined;
};

const loading = ref(true);
const collections = ref<Collection[]>([]);
const userCollections = ref<Collection[]>([]);
const selected = ref<Collection[]>([]);
const clientB = ref<any>(null);
const schemaDiffResponce = ref<any>(null);
const search = ref<string | null>(null);
const schema = ref<any | null>(null);
const collectionsSorted = computed(() => {
  const normalizedSearch = search.value?.toLowerCase();

  return sortBy(
    collections.value.filter(
      (collection) =>
        collection.collection.startsWith("directus_") === false &&
        !collection.meta.hidden &&
        collection.collection.toLowerCase().includes(normalizedSearch ?? '')
    ),
    ["meta.sort", "collection"]
  );
});
const headers = [
  { text: "", value: "icon" },
  {
    text: "Collection",
    value: "collection",
  },
];

const init = async () => {
  const clientA = createDirectus(envConfig.stageDirectus.url)
    .with(authentication())
    .with(rest());
  await clientA.login(
    envConfig.stageDirectus.login,
    envConfig.stageDirectus.password
  );
  collections.value = await clientA.request<Collection[]>(readCollections());
  schema.value = await clientA.request(schemaSnapshot());

  userCollections.value = collections.value.filter((collection) => !Boolean(collection.meta?.system));
  console.log("collections");
  console.log(userCollections.value, schema.value);
  console.log("========");

  clientB.value = createDirectus(envConfig.prodDirectus.url)
    .with(authentication())
    .with(rest());
  await clientB.value.login(
    envConfig.prodDirectus.login,
    envConfig.prodDirectus.password
  );

  loading.value = false;
};
onMounted(() => {
  init();
});

function recordFromCollectionabl(arr: { collection: string }[]) {
  return arr.reduce((acc, val) => {
    acc[val.collection] = {
      ...val,
    }

    return acc;
  }, {});
}

function mapFromCollectionabl(arr: { collection: string }[]) {
  const result = new Map();

   arr.forEach(element => {
    const tmpArr = result.get(element.collection);
    if (tmpArr) {
      tmpArr.push(element);
      result.set(element.collection, tmpArr);
    } else {
      result.set(element.collection, [element]);
    }
   });

   return result;
}


async function processConfiguration() {
	const configPath = path.resolve(process.env['CONFIG_PATH'] || path.resolve(process.cwd(), '.env'));

	if (fs.existsSync(configPath) === false) return {};

	const fileExt = path.extname(configPath).toLowerCase().substring(1);

	// Default to env vars plain text files
	return dotenv.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
}

async function handleApplyClick() {
  const tmpSelected = recordFromCollectionabl(selected.value);
  const tmpCollection = recordFromCollectionabl(schema.value.collections);
  const tmpFields = mapFromCollectionabl(schema.value.fields);
  const tmpRelations = mapFromCollectionabl(schema.value.relations);
  const queue = Object.keys(tmpSelected);
  const collectionScope: string[] = [];


  while (queue.length > 0) {
    const currentCollection = queue.pop() || '';
    collectionScope.push(currentCollection);
    const element = tmpRelations.get(currentCollection);
    if (element.length) {
      tmpRelations[currentCollection].forEach(element => {
        queue.push(element.collection);
      });
    }
  }

  console.log('collectionScope', collectionScope);

  // schemaDiffResponce.value = await clientB.value.request(schemaDiff(schema.value));

  // console.log("schemaDiff");
  // console.log(schemaDiffResponce.value,  schema.value);
  // console.log("========");

  // const result = await clientB.value.request(
  //   schemaApply(schemaDiffResponce.value)
  // );
}

function updateModelValue(newValue) {
  console.log("newValue", newValue);
  selected.value = newValue;
}
</script>

<template>
  <private-view title="Export">
    <h1 v-if="loading">Loading...</h1>
    <div v-else class="wrapper">
      <v-input
        v-model="search"
        class="search"
        :autofocus="collections.length > 25"
        type="search"
        :placeholder="'Search collection'"
        :full-width="false"
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

      <v-button @click="handleApplyClick">Apply diff</v-button>
      <div class="schema-management">
        <div class="collection-list">
          <VTable :showSelect="'multiple'" :headers="headers" :items="collectionsSorted" :modelValue="selected" :itemKey="'collection'" @update:modelValue="updateModelValue"></VTable>
          <!-- <v-card>
            <pre>{{ schemaDiffResponce }}</pre>
          </v-card> -->
        </div>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.wrapper {
  margin: 24px 32px;
}
.schema-management {
  padding: var(--content-padding);
  padding-top: 0;

  .collection-list {
    margin-top: 20px;
  }
}
</style>
