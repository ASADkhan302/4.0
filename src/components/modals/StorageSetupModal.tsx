import React from 'react';
import {
  WorkstationSetupModal,
  WorkstationSetupModalProps,
} from './WorkstationSetupModal';

export interface StorageSetupModalProps extends WorkstationSetupModalProps {}

export const StorageSetupModal: React.FC<StorageSetupModalProps> = (props) => {
  return <WorkstationSetupModal {...props} />;
};

export default StorageSetupModal;

