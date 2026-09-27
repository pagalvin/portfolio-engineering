import { Route } from 'react-router'
import { IntuitionLedgerLayout, IntuitionLedgerPage } from './IntuitionLedgerLayout'
import { PredictionFormPage } from './PredictionFormPage'
import { PredictionListPage } from './PredictionListPage'
import { DuePage } from './DuePage'
import { PredictionDetailPage } from './PredictionDetailPage'

export const intuitionLedgerRoutes = (
  <Route path="/workspace/intuition-ledger" element={<IntuitionLedgerLayout />}>
    <Route index element={<IntuitionLedgerPage view="overview" />} />
    <Route path="due" element={<DuePage />} />
    <Route path="predictions" element={<PredictionListPage />} />
    <Route path="predictions/new" element={<PredictionFormPage mode="create" />} />
    <Route path="predictions/:predictionId/edit" element={<PredictionFormPage mode="edit" />} />
    <Route path="predictions/:predictionId" element={<PredictionDetailPage />} />
  </Route>
)
