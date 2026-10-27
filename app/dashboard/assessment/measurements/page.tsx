import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import MeasurementAssessment from '@/components/MeasurementAssessment'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

export default async function MeasurementsPage() {
  const { client } = await getDashboardContext()
  return <PhoneAppFrame eyebrow="Physical assessment" title="Measure with clarity, not pressure." subtitle="Consistent reference points. A clearer picture.">
    <MeasurementAssessment clientId={client.client_id} />
  </PhoneAppFrame>
}
