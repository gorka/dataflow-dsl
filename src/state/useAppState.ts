import { useContext } from 'react';

import type { AppState, AppAction } from './appState';
import { AppStateContext, AppDispatchContext } from './AppProvider';
import type { Dispatch } from 'react';

export function useAppState(): AppState {
  return useContext(AppStateContext);
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}
