-- Migration 055: Kort ned AI-lenketekster for mobilvennlighet
--
-- "Skolekretsen dekker barneskole, ungdomsskole og videregående" → "Skolekretsen"
-- "Bakklandet til Solsiden" er allerede kort — OK

UPDATE products
SET config = jsonb_set(config,
  '{reportConfig,themes,1,extendedBridgeText}',
  '"Brøset-kretsen har aktivt FAU og variert SFO-tilbud for barna. Brøset barnehage er nærmest, men over tjue alternativer finnes innen kort avstand, både kommunale og private. Blussuvoll ungdomsskole ligger like ved for de eldre barna. [Skolekretsen](https://www.google.com/search?udm=50&q=skolekrets+Br%C3%B8set+Trondheim+barneskole+ungdomsskole+videreg%C3%A5ende+Blussuvoll+Strindheim+Charlottenlund+opptaksomr%C3%A5de) dekker barneskole, ungdomsskole og videregående — og det skjer mye i området med ny utbygging. Idrettsanleggene på Leangen og Blussuvoll har fotball, handball, svømming og friidrett — og lekeplassen i Ole Hogstads veg er to minutter fra døren. Et nabolag der barna kan gå til skolen på egenhånd og finne noe å gjøre etter skoletid."'::jsonb
)
WHERE id = 'c87b51f6-9cf7-4738-b452-cbea0bb62c65';
