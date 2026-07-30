import DayBlockScreen from '../components/DayBlockScreen'
import { mockDashboard } from '../lib/mockData'

export default function EveningScreen() {
  return <DayBlockScreen block={mockDashboard.plan[2]} />
}
