import DayBlockScreen from '../components/DayBlockScreen'
import { mockDashboard } from '../lib/mockData'

export default function MiddayScreen() {
  return <DayBlockScreen block={mockDashboard.plan[1]} />
}
