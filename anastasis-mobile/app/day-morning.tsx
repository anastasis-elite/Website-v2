import DayBlockScreen from '../components/DayBlockScreen'
import { mockDashboard } from '../lib/mockData'

export default function MorningScreen() {
  return <DayBlockScreen block={mockDashboard.plan[0]} />
}
