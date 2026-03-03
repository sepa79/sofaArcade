export {
  createActionCatalog,
  requireAction,
  type ActionCatalog,
  type ActionDefinition,
  type ActionType,
  type Axis1DActionDefinition,
  type AxisDomain,
  type AxisSpace,
  type DigitalActionDefinition
} from './input/actions';

export { createInputRuntime, type InputRuntime } from './input/runtime';

export {
  applyInputProfile,
  createInputSourceFrame,
  type InputSourceFrame
} from './input/executor';

export {
  createInputProfile,
  type Axis1DBinding,
  type AxisSourceKind,
  type DigitalBinding,
  type DigitalSourceKind,
  type InputBinding,
  type InputProfile
} from './input/profile';

export { loadInputProfile, parseInputProfileData } from './input/profile-loader';

export {
  createPhoneRelayInputMessage,
  parsePhoneRelayClientMessage,
  parsePhoneRelayInputMessage,
  parsePhoneRelayServerMessage,
  type PhoneRelayAckMessage,
  type PhoneRelayClientMessage,
  type PhoneRelayErrorMessage,
  type PhoneRelayInputMessage,
  type PhoneRelayInputPayload,
  type PhoneRelayJoinMessage,
  type PhoneRelayRole,
  type PhoneRelayServerMessage,
  type PhoneRelayStatusKind,
  type PhoneRelayStatusMessage
} from './phone/protocol';

export {
  createPhoneControllerProvider,
  type PhoneControllerFrame,
  type PhoneControllerProvider,
  type PhoneControllerProviderConfig
} from './phone/provider';
