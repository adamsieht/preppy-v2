import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface DevSettingsState {
  verboseErrors: boolean
}

const initialState: DevSettingsState = {
  verboseErrors: false,
}

const devSettingsSlice = createSlice({
  name: 'devSettings',
  initialState,
  reducers: {
    setVerboseErrors(state, action: PayloadAction<boolean>) {
      state.verboseErrors = action.payload
    },
  },
})

export const { setVerboseErrors } = devSettingsSlice.actions
export default devSettingsSlice.reducer
