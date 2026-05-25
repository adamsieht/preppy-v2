import { configureStore } from '@reduxjs/toolkit'
import alertsReducer from './slices/alerts.slice'
import sensorsReducer from './slices/sensors.slice'
import devSettingsReducer from './slices/devSettings.slice'

export const store = configureStore({
  reducer: {
    alerts: alertsReducer,
    sensors: sensorsReducer,
    devSettings: devSettingsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
