# Anastasis Health Integration

The mobile app is the health-data bridge. HealthKit and Health Connect are provider adapters; backend logic receives only normalized Anastasis health samples.

## Runtime Requirements

- Expo Go is not supported for HealthKit or Health Connect native modules.
- Use a custom development build or production build.
- iOS requires the HealthKit capability, the HealthKit entitlement, and `NSHealthShareUsageDescription`.
- Android requires Health Connect availability, Android `minSdkVersion` 26+, and declared Health Connect read permissions.

## Development Builds

From `anastasis-mobile`:

```sh
npm install
npm run prebuild
npm run ios:dev
npm run android:dev
```

EAS development builds can use the same Expo config:

```sh
eas build --profile development --platform ios
eas build --profile development --platform android
```

Physical-device verification is required for real permissions and live samples. Simulators and emulators may report unavailable providers or empty datasets.

## Sync Strategy

- Initial sync imports the last 30 days. This matches current Daily State and trend horizons without requesting older Health Connect history permissions.
- Incremental sync starts from the provider integration's last successful sync timestamp.
- Foreground sync is throttled to at most once every six hours.
- Manual sync is available from `Health & Wearables`.

## Data Flow

Provider record -> provider adapter -> normalized health sample -> `health_samples` -> `daily_health_metrics` -> Daily State -> adaptive schedule -> Next Action.

Manual tracking remains the fallback when passive health data is missing, denied, partial, or unavailable.
