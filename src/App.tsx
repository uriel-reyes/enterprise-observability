import React from 'react';
import { useSDK } from '@contentful/react-apps-toolkit';
import { locations } from '@contentful/app-sdk';
import { ObservabilityPage } from './locations/Page';

export default function App() {
  const sdk = useSDK();

  if (sdk.location.is(locations.LOCATION_PAGE)) {
    return <ObservabilityPage />;
  }

  return null;
}

