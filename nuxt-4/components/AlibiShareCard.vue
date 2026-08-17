<!--
  AlibiShareCard.vue — Vue 3 / Nuxt 4 komponent
  Virálna karta pre zdieľanie rozporu na LinkedIn / sociálne siete.
  Prenesené z React verzie (src/components/share/AlibiShareCard.tsx).

  Použitie v Nuxt 4:
  <AlibiShareCard :analysis="analysis" @close="showShare = false" />

  Props:
    - analysis: Analysis object (metadata, persons, timeline, evidence, relationships)
  Emits:
    - close: zatvorenie modálu
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Analysis } from '~/lib/types'

interface Props {
  analysis: Analysis
}
const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const copied = ref(false)

// Nájdi rozpor v timeline
const contradiction = computed(() =>
  props.analysis.timeline.find((e) => e.tags.includes('rozpor'))
)

// Nájdi alibi event
const alibiEvent = computed(() =>
  props.analysis.timeline.find((e) => e.tags.includes('alibi'))
)

// Obvinený
const accused = computed(() =>
  props.analysis.persons.find((p) => p.role === 'obvinený')
)

// Text pre zdieľanie
const shareText = computed(() =>
  `🚨 ${accused.value?.name || 'Obvinený'} tvrdí, že bol na inom mieste — ale AI našla rozpor v spise.\n\n${contradiction.value?.title || 'Rozpor vo výpovedi'}\n\nForenzDetectiv — AI, ktorá nájde rozpor za sekundu.`
)

// Native Share API (mobil) alebo clipboard fallback
async function handleShare() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'ForenzDetectiv — Alibi Impossible',
        text: shareText.value,
        url: window.location.href,
      })
    } catch {
      // User zrušil share
    }
  } else {
    try {
      await navigator.clipboard.writeText(shareText.value)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    } catch {
      console.error('Kopírovanie zlyhalo')
    }
  }
}
</script>

<template>
  <!-- Overlay -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    style="height: 100dvh"
    @click="emit('close')"
  >
    <!-- Karta -->
    <div
      class="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden max-w-sm w-full"
      @click.stop
    >
      <!-- Header — gradient -->
      <div class="bg-gradient-to-br from-red-500/20 to-slate-900 p-5 pb-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <span class="text-xs font-bold text-red-500 uppercase tracking-wide">
            Alibi Impossible
          </span>
        </div>
        <h2 class="text-lg font-bold text-slate-100 leading-tight">
          {{ accused?.name || 'Obvinený' }} tvrdí, že bol inde.
        </h2>
        <p class="text-sm text-slate-400 mt-1">
          AI našla rozpor v spise.
        </p>
      </div>

      <!-- Rozpor -->
      <div v-if="contradiction" class="p-5">
        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-3">
          <p class="text-[10px] uppercase tracking-wide text-red-500 font-bold mb-1">
            Rozpor
          </p>
          <p class="text-sm text-slate-100 font-medium mb-2">
            {{ contradiction.title }}
          </p>
          <p class="text-xs text-slate-400 leading-relaxed">
            {{ contradiction.description }}
          </p>
          <p v-if="contradiction.source_text" class="text-[11px] text-slate-500 italic mt-2">
            „{{ contradiction.source_text }}"
          </p>
        </div>

        <!-- Alibi vs fakt -->
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-blue-400/10 border border-blue-400/20 rounded-xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-blue-400 font-bold mb-1">
              Alibi
            </p>
            <p class="text-xs text-slate-300">
              {{ alibiEvent?.title || 'Bol inde' }}
            </p>
          </div>
          <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-red-500 font-bold mb-1">
              Fakt
            </p>
            <p class="text-xs text-slate-300">
              {{ contradiction.title }}
            </p>
          </div>
        </div>
      </div>

      <!-- Footer — branding + CTA -->
      <div class="px-5 pb-5">
        <div class="flex items-center justify-between mb-4 pt-3 border-t border-white/5">
          <div class="flex items-center gap-1.5">
            <div class="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center">
              <span class="text-[8px] font-bold text-amber-500">FD</span>
            </div>
            <span class="text-[11px] text-slate-500 font-medium">
              ForenzDetectiv
            </span>
          </div>
          <span class="text-[10px] text-slate-600">
            AI rozpory vo výpovediach
          </span>
        </div>

        <!-- Tlačidlá -->
        <button
          @click="handleShare"
          class="w-full bg-amber-500 text-slate-950 font-semibold py-4 px-6 rounded-2xl mb-2 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <svg v-if="copied" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {{ copied ? 'Skopírované!' : 'Zdieľať' }}
        </button>
        <button
          @click="emit('close')"
          class="w-full border border-slate-700 text-slate-200 font-medium py-4 px-6 rounded-2xl"
        >
          Zavrieť
        </button>
      </div>
    </div>
  </div>
</template>
