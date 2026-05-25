import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Alert {
  id: string
  variant: 'success' | 'danger' | 'warning' | 'info'
  msg: string
}

interface AlertsState {
  alerts: Alert[]
}

const initialState: AlertsState = { alerts: [] }

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    addAlert(state, action: PayloadAction<Omit<Alert, 'id'>>) {
      state.alerts.push({ ...action.payload, id: crypto.randomUUID() })
    },
    removeAlert(state, action: PayloadAction<string>) {
      state.alerts = state.alerts.filter((a) => a.id !== action.payload)
    },
    clearAlerts(state) {
      state.alerts = []
    },
  },
})

export const { addAlert, removeAlert, clearAlerts } = alertsSlice.actions
export default alertsSlice.reducer
