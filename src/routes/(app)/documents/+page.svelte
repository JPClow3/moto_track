<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { t } from "$lib/i18n/store";
  let { data, form } = $props();

  // The feature config ships English infrastructure copy ("R2-backed files");
  // override it with the localized page identity like /reminders does.
  let localizedFeature = $derived({
    ...data.feature,
    title: $t("documents.pageTitle"),
    subtitle: $t("documents.pageSubtitle"),
  });
</script>

<svelte:head
  ><title>{$t("documents.pageTitle")} · Moto Track</title></svelte:head
>

<FeaturePage
  routeSlug="documents"
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage={!form?.ok
    ? form?.message || data.errorMessage
    : data.errorMessage}
/>
