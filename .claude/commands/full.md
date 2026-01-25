# Full Workflow

Kjør hele compound-engineering workflow-pipelinen for en feature eller oppgave.

## Bruk

```
/full [beskrivelse av feature/oppgave]
```

## Workflow-faser

Gå gjennom disse fasene i rekkefølge. Hver fase skal fullføres før neste starter.

### Fase 1: Brainstorm
Utforsk krav og tilnærminger før planlegging.
- Forstå brukerens intensjon
- Identifiser uklarheter og avhengigheter
- Vurder alternative tilnærminger
- Still oppklarende spørsmål hvis nødvendig

### Fase 2: Plan
Lag en strukturert implementeringsplan.
- Definer klare arbeidspakker
- Identifiser filer som må endres/opprettes
- Beskriv teknisk tilnærming
- Lagre plan i `docs/plans/` med dato-prefiks

### Fase 3: Work
Utfør implementeringen systematisk.
- Følg planen steg for steg
- Test underveis
- Hold koden enkel og fokusert

### Fase 4: Compound
Dokumenter løsningen for fremtidig referanse.
- Hvis problemet/løsningen er gjenbrukbar, lagre i `docs/solutions/`
- Inkluder kontekst, problem, løsning og gotchas

## Instruksjoner

Når denne kommandoen kjøres:

1. Start med å forstå oppgaven fra brukerens input
2. Kjør brainstorm-fasen - utforsk og still spørsmål
3. Når brainstorm er ferdig, lag en konkret plan
4. Etter plan-godkjenning, implementer løsningen
5. Avslutt med å vurdere om løsningen bør dokumenteres

Ikke hopp over faser. Hver fase bygger på den forrige.
