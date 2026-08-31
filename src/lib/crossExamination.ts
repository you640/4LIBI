/**
 * Cross-Examination AI Engine — generátor cielených konfrontačných otázok.
 * Kombinuje deterministické právne šablóny s volaním Mistral AI pre výsluchy svedkov a obvinených.
 */

import { callMistralApi } from './mistralApi';
import type { CrossExamQuestion, Contradiction } from '../types';

export const CROSS_EXAM_MODES = {
  mild: {
    id: 'mild',
    label: 'Mierny výsluch svedka',
    description: 'Neutrálne, objasňujúce otázky vhodné pre svedka na pojednávaní.',
    tone: 'mierny'
  },
  aggressive: {
    id: 'aggressive',
    label: 'Agresívny krížový výslech obhajoby',
    description: 'Konfrontačné otázky zamerané na rozpor a nedôveryhodnosť.',
    tone: 'agresívny'
  },
  alibi: {
    id: 'alibi',
    label: 'Detailná verifikácia alibi',
    description: 'Chronologické a geografické overenie tvrdeného alibi.',
    tone: 'verifikačný'
  },
  forensic: {
    id: 'forensic',
    label: 'Forenzné preverenie tokov a rolí',
    description: 'Konfrontácia financovania, identity preberateľov a rozporov v listinách.',
    tone: 'forenzný'
  }
};

export function buildLocalCrossExamQuestions(
  contradictions: Contradiction[] = [],
  mode: 'mild' | 'aggressive' | 'alibi' | 'forensic' = 'aggressive'
): CrossExamQuestion[] {
  const questions: CrossExamQuestion[] = [];

  for (const c of contradictions) {
    const person = c.entity_ref || 'Svedok';
    const explanation = c.explanation || 'Zistený časovo-priestorový rozpor.';

    let qText: string;
    let rationale: string;

    if (mode === 'aggressive') {
      qText = `Ako vysvetlíte, že vo vašej výpovedi tvrdíte pobyt na uvedenom mieste, hoci dôkazy a svedectvá jednoznačne preukazujú: ${explanation}?`;
      rationale = 'Konfrontácia priamym rozporom zameraná na spochybnenie dôveryhodnosti výpovede.';
    } else if (mode === 'alibi') {
      qText = `Môžete krok po kroku a minútu po minúte opísať váš pohyb v kritickom čase vzhľadom na zistenú nezrovnalosť: ${explanation}?`;
      rationale = 'Detailná chronologická rekonštrukcia alibi pre odhalenie trhlín v časovej osi.';
    } else if (mode === 'forensic') {
      qText = `Na základe akej zmluvy, splnomocnenia alebo pokynu ste konali a ako vysvetlíte forenzný rozpor v materiálnom toku: ${explanation}?`;
      rationale = 'Preverenie právneho titulu, oddelenia rolí (kupujúci vs. platiteľ vs. preberateľ) a finančných tokov.';
    } else {
      qText = `Mohli by ste bližšie vysvetliť a objasniť okolnosť týkajúcu sa: ${explanation}?`;
      rationale = 'Objasnenie faktického stavu bez nátlaku na svedka.';
    }

    questions.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: qText,
      rationale,
      targetPerson: person,
      contradictionRef: c.id,
      citation: {
        documentTitle: c.document_title || 'Vyšetrovací spis',
        passage: c.explanation || 'Konfrontačný bod',
        page: 1,
        line: null
      },
      suggestedFollowUps: [
        'Kto ďalší môže potvrdiť vašu prítomnosť na tomto mieste?',
        'Máte k dispozícii elektronické dôkazy (platby, GPS, hovory)?',
        'Prečo sa vaša výpoveď odlišuje od predchádzajúcich tvrdení?'
      ]
    });
  }

  return questions;
}

export async function generateCrossExamWithMistral(
  contradictions: Contradiction[],
  contextText: string,
  apiKey: string,
  mode: 'mild' | 'aggressive' | 'alibi' = 'aggressive'
): Promise<CrossExamQuestion[]> {
  if (!apiKey) {
    return buildLocalCrossExamQuestions(contradictions, mode);
  }

  const systemPrompt = `Si elitný advokát a forenzný vyšetrovateľ. Tvojou úlohou je vygenerovať ostré, precízne a právne podložené konfrontačné otázky na krížový výsluch (cross-examination) na základe zistených rozporov vo vyšetrovacom spise.
Zvolený režim výsluchu: ${CROSS_EXAM_MODES[mode]?.label || mode}.

Výstup MUSÍ byť čistý JSON v tomto formáte:
{
  "questions": [
    {
      "id": "q1",
      "targetPerson": "Meno osoby",
      "question": "Presné znenie otázky na výsluch",
      "rationale": "Taktický dôvod položenia otázky a právny cieľ",
      "citation": {
        "documentTitle": "Názov dokumentu",
        "passage": "Citát alebo rozpor",
        "page": 1
      },
      "suggestedFollowUps": ["Nadväzujúca otázka 1", "Nadväzujúca otázka 2"]
    }
  ]
}`;

  const userPrompt = `Vygeneruj konfrontačné otázky k týmto rozporom:\n${JSON.stringify(contradictions, null, 2)}\n\nKontext spisu:\n${contextText.slice(0, 4000)}`;

  try {
    const raw = await callMistralApi(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { apiKey, temperature: 0.2, jsonObject: true }
    );

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions;
    }
  } catch (err) {
    console.warn('[CrossExam] Mistral fallback to local rules:', err);
  }

  return buildLocalCrossExamQuestions(contradictions, mode);
}
