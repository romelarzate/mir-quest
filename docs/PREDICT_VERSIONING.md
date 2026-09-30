# Versionado y reproducibilidad

## Cinco versiones

```
DatasetVersion     id, label, createdAt, sourceDocumentIds[],
                   historicalQuestionCount, hash, isDemo
TaxonomyVersion    id, label, createdAt, clinicalDomainCount,
                   mappingCount, hash
FeatureVersion     id, label, createdAt, featureKeys[], hash
ModelVersion       id, label, createdAt, kind, calibrated, notes
SimulationVersion  id, label, createdAt, algorithm, usesSeed
```

`ModelVersion.kind` admite `statistical`, `ml`, `hybrid` o `none`.

## Paquete de versiones

```
VersionBundle
  datasetVersion     string
  taxonomyVersion    string
  featureVersion     string
  modelVersion       string | null
  simulationVersion  string
```

Una predicción debe registrar exactamente las versiones que produjeron el resultado. Si `modelVersion` es `null`, el resultado no puede presentarse como calibrado: `isCalibrationPossible()` devuelve falso.

## Compatibilidad

`checkVersionCompatibility(provided, required)` compara solo los campos requeridos y devuelve `version-mismatch` indicando el tipo de versión afectado.

```
provided  dataset=d2  taxonomy=t1  feature=f1
required  dataset=d1
resultado version-mismatch :: dataset
```

## Reproducibilidad de simulaciones

```
SimulationManifest
  simulationId        identificador de la simulación
  seed                semilla declarada
  datasetVersion      versión del dataset
  taxonomyVersion     versión de taxonomía
  featureVersion      versión de features
  modelVersion        versión de modelo (puede ser null)
  simulationVersion   versión del algoritmo de simulación
  generatedAt         fecha de generación
  questionIds[]       conjunto ordenado resultante
  hash                SHA-256 del contenido
  hashAlgorithm       sha-256
  secondaryHash       null (reservado para compatibilidad MD5)
```

Derivación de la semilla:

```
sha256( seed | questionCount | subjectIds ordenados |
        topicIds ordenados | clinicalDomainIds ordenados | versiones )
        |
        v
   entero de 32 bits  ->  generador mulberry32  ->  barajado determinista
```

Misma semilla + mismo dataset + misma configuración devuelve el mismo conjunto ordenado. La prueba `reproducibility.test.ts` lo verifica junto con `verifyManifest`, que recalcula el hash y detecta cualquier manipulación.

## Política de hashes

- SHA-256 es el hash principal y el único identificador criptográfico.
- MD5 solo se admite como hash secundario de compatibilidad (`legacySecondaryHashAlgorithm`).
- El manifiesto declara `secondaryHash: null` porque MIR Quest no necesita compatibilidad MD5.

## Qué garantiza el versionado

1. Toda predicción puede auditarse: dataset, taxonomía, features y modelo.
2. Toda simulación puede reproducirse desde su semilla y su manifiesto.
3. Un cambio de dataset cambia el hash y por tanto el resultado.
4. Un resultado sin `modelVersion` nunca se presenta como probabilidad.
