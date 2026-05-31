type Args = {
  changeGoal?: string
  supportReason?: string
}

function normalize(value?: string) {
  return String(value || '').toLowerCase()
}

export function getApplicationRedirect({
  changeGoal,
  supportReason,
}: Args) {
  const text = `${normalize(changeGoal)} ${normalize(supportReason)}`

  // PHOENIX
  if (
    text.includes('competition') ||
    text.includes('bodybuilding') ||
    text.includes('elite') ||
    text.includes('stage') ||
    text.includes('advanced') ||
    text.includes('serious transformation') ||
    text.includes('full transformation') ||
    text.includes('accountability')
  ) {
    return '/program/phoenix/recommend'
  }

  // IGNITE
  if (
    text.includes('strength') ||
    text.includes('muscle') ||
    text.includes('weight loss') ||
    text.includes('belly fat') ||
    text.includes('recomp') ||
    text.includes('body recomposition') ||
    text.includes('consistency') ||
    text.includes('gym confidence')
  ) {
    return '/program/ignite/recommend'
  }

  // EMBER
  return '/program/ember/recommend'
}
