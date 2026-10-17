/** Shown for an unknown route; offers a way back to the workspace. */
import { Compass } from 'lucide-react'
import { navigate } from '../lib/router'
import { Button } from '../components/common/Controls'
import { EmptyState } from '../components/common/States'

export function NotFoundPage() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <EmptyState
        icon={<Compass size={20} />}
        title="That screen does not exist"
        description="The link may be from an older version of Cloud AI."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        }
      />
    </div>
  )
}
