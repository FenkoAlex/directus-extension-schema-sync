<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { intersectionWith } from "lodash";

import { schemaSnapshot, schemaDiff, schemaApply } from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";

import { COLLECTION_HEADER } from "./const";

import {
  Collection as DirectusCollection,
  Field,
  Relation,
} from "@directus/shared/types";

import { initDirectusClients } from "./init-directus-clients";
import Nav from "./nav.vue";
import { nav } from "./path";
import { mapFromCollectionabl, recordFromCollectionabl } from "./utils";

import type { Collection } from "./types";

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const schemaDiffResponce = ref<any>(null);
const schema = ref<any | null>(null);
const relationsMap = ref<any>(null);
const canApplySchema = ref(false);
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
  schema.value = await clientA.value.request(schemaSnapshot());
  relationsMap.value = mapFromCollectionabl(schema.value!.relations as any);

  schemaDiffResponce.value = await clientB.value.request(
    schemaDiff(schema.value)
  );

  console.log(schemaDiffResponce.value);

  if (schemaDiffResponce.value?.status === 204) {
    console.log("everything is updated!");
  } else {
    canApplySchema.value = true;
    changedCollections.value = schemaDiffResponce.value.diff.collections;
  }

  loading.value = false;
}
onMounted(() => {
  init();
});

const handleApplyClick = ref(async () => {
  try {
    console.log("relationsMap.value", relationsMap.value);

    const diffCollections = recordFromCollectionabl(selected.value);
    const diffFields = mapFromCollectionabl(
      schemaDiffResponce.value.diff.fields
    );
    const diffRelations = mapFromCollectionabl(
      schemaDiffResponce.value.diff.relations
    );
    console.log(
      "diffCollections, diffFields, diffRelations",
      diffCollections,
      diffFields,
      diffRelations
    );
    console.log("relationsMap.value", relationsMap.value);
    const tmpSchemaDiff = {
      hash: schemaDiffResponce.value.hash,
      diff: {
        collections: [] as any[],
        fields: [] as any[],
        relations: [] as any[],
      },
    };
    for (let [key, item] of Object.entries(diffCollections)) {
      tmpSchemaDiff.diff.collections.push(item);
      if (diffFields.has(key)) {
        tmpSchemaDiff.diff.fields.push(...diffFields.get(key));
      }
      if (diffRelations.has(key)) {
        tmpSchemaDiff.diff.relations.push(...diffRelations.get(key));
      }
    }

    console.log("tmpSchemaDiff", tmpSchemaDiff);

    const result = await clientB.value.request(schemaApply(tmpSchemaDiff));

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
        <v-button @click="handleApplyClick" :disabled="!canApplySchema"
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
          :value="schemaDiffResponce"
          :line-number="false"
          :alt-options="{ gutters: false }"
          language="json"
        />
        <h1 v-if="!canApplySchema">Everything is updated</h1>
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
