<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useStores } from "@directus/extensions-sdk";

import { COLLECTION_HEADER, COLLECTION_TO_EXCLUDE_FROM_SCHEMA } from "./const";

import { initDirectusClients } from "./init-directus-clients";
import Nav from "./nav.vue";
import { nav } from "./path";
import { mapFromCollectionable, recordFromCollectionable } from "./utils";

import type { Collection } from "./types";
import { useSchema } from "./useSchema";

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const schema = ref<any | null>(null);
const relationsMap = ref<any>(null);
const changedCollections = ref(null);
const selected = ref<Collection[]>([]);
const clientA = ref<any>(null);
const clientB = ref<any>(null);

const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;
  requestInitData();
};
async function requestInitData() {
  loading.value = true;

  // getting schema and sort it to collections, fields and relations
  schema.value = await useSchema(clientA.value, clientB.value);
  relationsMap.value = schema.value.relationsMap;
  console.log("relationsMap:", relationsMap.value);

  changedCollections.value =
    schema.value?.diffResponce?.diff?.collections?.filter(
      (item) => !COLLECTION_TO_EXCLUDE_FROM_SCHEMA[item.collection]
    );

  loading.value = false;
}
onMounted(() => {
  init();
});

const handleApplyClick = ref(async () => {
  try {
    console.log("relationsMap.value", relationsMap.value);

    const diffCollections = recordFromCollectionable(selected.value);
    const diffFields = mapFromCollectionable(
      schema.value?.diffResponce.diff.fields
    );
    const diffRelations = mapFromCollectionable(
      schema.value?.diffResponce.diff.relations
    );
    console.log(
      "diffCollections, diffFields, diffRelations",
      diffCollections,
      diffFields,
      diffRelations
    );
    console.log("relationsMap.value", relationsMap.value);
    const tmpSchemaDiff = {
      hash: schema.value?.diffResponce.hash,
      diff: {
        collections: [] as any[],
        fields: [] as any[],
        relations: [] as any[],
      },
    };
    for (let [key, item] of Object.entries(diffCollections)) {
      if (COLLECTION_TO_EXCLUDE_FROM_SCHEMA[key]) continue;

      tmpSchemaDiff.diff.collections.push(item);
      if (diffFields.has(key)) {
        tmpSchemaDiff.diff.fields.push(...diffFields.get(key));
      }
      if (diffRelations.has(key)) {
        tmpSchemaDiff.diff.relations.push(...diffRelations.get(key));
      }
    }

    console.log("tmpSchemaDiff", tmpSchemaDiff);

    await schema.value.applySchema(tmpSchemaDiff);

    notificationsStore.add({
      type: "success",
      title: "Change applied successfully",
      dialog: false,
    });
    requestInitData();
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
</script>

<template>
  <private-view title="Export">
    <template v-slot:navigation>
      <Nav :activeItem="nav.main.id" />
    </template>
    <div class="wrapper">
      <div class="mb32">
        <v-button @click="handleApplyClick" :disabled="!schema?.canApply"
          >Apply diff</v-button
        >
      </div>
      <div class="loaderWrapper" v-if="loading">
        <v-progress-circular class="loader" indeterminate />
      </div>
      <div v-else>
        <VTable
          class="mb32"
          :showSelect="'multiple'"
          :headers="COLLECTION_HEADER"
          :items="changedCollections"
          :itemKey="'collection'"
          :loading="loading"
          v-model="selected"
        ></VTable>
        <interface-input-code
          :value="schema.diffResponce"
          :line-number="false"
          :alt-options="{ gutters: false }"
          language="json"
        />
        <h1 v-if="!schema?.canApply">Everything is updated</h1>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.loaderWrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
.wrapper {
  margin: 24px 32px;
}

.mb32 {
  margin-bottom: 32px;
}
</style>
