import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface SensorReading {
  mac: string
  temperature: number
  humidity: number
  battery: number
  last_update: string
}

interface SensorsState {
  sensors: SensorReading[]
}

const initialState: SensorsState = { sensors: [] }

const sensorsSlice = createSlice({
  name: 'sensors',
  initialState,
  reducers: {
    setSensors(state, action: PayloadAction<SensorReading[]>) {
      state.sensors = action.payload
    },
    updateSensor(state, action: PayloadAction<SensorReading>) {
      const idx = state.sensors.findIndex((s) => s.mac === action.payload.mac)
      if (idx >= 0) {
        state.sensors[idx] = action.payload
      } else {
        state.sensors.push(action.payload)
      }
    },
  },
})

export const { setSensors, updateSensor } = sensorsSlice.actions
export default sensorsSlice.reducer
