import React from 'react';
import { WorkstationSetupModal } from './WorkstationSetupModal';

export interface WelcomeLibraryModalProps {
  isOpen: boolean;
  isMissingPath?: boolean;
  missingPath?: string;
  onOpenStorageModal?: (option?: 'create_new' | 'open_existing') => void;
  onClose: () => void;
  onComplete: (message: string) => void;
  onNavigateToCatalog?: () => void;
}

export const WelcomeLibraryModal: React.FC<WelcomeLibraryModalProps> = ({
  isOpen,
  isMissingPath = false,
  onClose,
  onComplete,
  onNavigateToCatalog,
}) => {
  return (
    <WorkstationSetupModal
      isOpen={isOpen}
      isResetMode={!isMissingPath}
      onClose={onClose}
      onCompleteMessage={onComplete}
      onNavigateToCatalog={onNavigateToCatalog}
    />
  );
};
