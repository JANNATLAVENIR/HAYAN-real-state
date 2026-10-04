module.exports = ({ config }) => {
  const localExpoGo = process.env.DALKA_EXPO_GO_LOCAL === "1";
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const { owner, extra: configuredExtra = {}, ...baseConfig } = config;
  const extra = { ...configuredExtra };

  // Expo Go's signed-manifest flow asks users to authenticate when an EAS
  // project ID is present. Keep EAS linkage in app.json for EAS builds, while
  // omitting it only for this local, anonymous Expo Go command.
  if (localExpoGo && extra.eas) {
    const { projectId: _projectId, ...otherEasConfig } = extra.eas;
    if (Object.keys(otherEasConfig).length) extra.eas = otherEasConfig;
    else delete extra.eas;
  }

  const easProjectId = localExpoGo ? undefined : process.env.EXPO_PUBLIC_EAS_PROJECT_ID || extra.eas?.projectId;
  if (easProjectId) extra.eas = { ...extra.eas, projectId: easProjectId };

  return {
    ...baseConfig,
    ...(!localExpoGo && owner ? { owner } : {}),
    ...(Object.keys(extra).length ? { extra } : {}),
    android: {
      ...config.android,
      ...(apiKey ? { config: { ...config.android?.config, googleMaps: { apiKey } } } : {}),
    },
  };
};
