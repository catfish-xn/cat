import { disposeAfterEach, registerMelSave } from './mel-save-settlement-helpers';

// Split out of mel-save-settlement.test.ts so the two streaming modes run on separate workers.
disposeAfterEach();
registerMelSave(true);
