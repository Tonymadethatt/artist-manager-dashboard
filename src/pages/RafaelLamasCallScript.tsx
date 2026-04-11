/**
 * Legacy route removed from App. Re-exports checklist for any deep links during transition.
 * Prefer Forms → Intake or `@/lib/intake/CallIntakeScriptChecklist`.
 */
import { CallIntakeScriptChecklist, RafaelLamasCallScriptChecklist } from '@/lib/intake/CallIntakeScriptChecklist'

export { RafaelLamasCallScriptChecklist, CallIntakeScriptChecklist }

export default function RafaelLamasCallScript() {
  return <CallIntakeScriptChecklist />
}
