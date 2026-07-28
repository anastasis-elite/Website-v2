'use client'

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

type TriggerRenderProps = {
  open: boolean
  addingWater: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  toggle: () => void
}

type HydrationQuickAddProps = {
  clientId: string
  consumed: number
  target: number

  defaultOunces?: number
  minimumOunces?: number
  maximumOunces?: number
  stepOunces?: number

  onSaved?: (newConsumedTotal: number) => void

  renderTrigger: (
    props: TriggerRenderProps
  ) => ReactNode
}

type PopupPosition = {
  top: number
  left: number
}

export default function HydrationQuickAdd({
  clientId,
  consumed,
  target,

  defaultOunces = 8,
  minimumOunces = 4,
  maximumOunces = 64,
  stepOunces = 4,

  onSaved,

  renderTrigger,
}: HydrationQuickAddProps) {
  const router = useRouter()

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [waterOunces, setWaterOunces] =
    useState(defaultOunces)
  const [addingWater, setAddingWater] = useState(false)
  const [message, setMessage] = useState('')
  const [popupPosition, setPopupPosition] =
    useState<PopupPosition | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPopupPosition(null)
      return
    }

    function updatePopupPosition() {
      const trigger = triggerRef.current

      if (!trigger) {
        return
      }

      const rect = trigger.getBoundingClientRect()

      const popupWidth = Math.min(
        290,
        window.innerWidth - 32
      )

      const preferredLeft =
        rect.left + rect.width * 0.7

      const minimumLeft =
        16 + popupWidth * 0.35

      const maximumLeft =
        window.innerWidth -
        16 -
        popupWidth * 0.65

      const clampedLeft = Math.max(
        minimumLeft,
        Math.min(preferredLeft, maximumLeft)
      )

      setPopupPosition({
        top: rect.bottom + 12,
        left: clampedLeft,
      })
    }

    updatePopupPosition()

    window.addEventListener(
      'resize',
      updatePopupPosition
    )

    window.addEventListener(
      'scroll',
      updatePopupPosition,
      true
    )

    return () => {
      window.removeEventListener(
        'resize',
        updatePopupPosition
      )

      window.removeEventListener(
        'scroll',
        updatePopupPosition,
        true
      )
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const targetNode = event.target as Node

      const clickedTrigger =
        wrapperRef.current?.contains(targetNode) ??
        false

      const clickedPopup =
        popupRef.current?.contains(targetNode) ??
        false

      if (!clickedTrigger && !clickedPopup) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [open])

  function toggle() {
    setMessage('')
    setOpen((current) => !current)
  }

  async function addWater() {
    if (addingWater) {
      return
    }

    setAddingWater(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/nutrition/add-water',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId,
            ounces: waterOunces,
          }),
        }
      )

      const payload = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        setMessage(
          payload?.error ||
            'Water could not be saved.'
        )

        return
      }

      const fallbackTotal =
        Number(consumed) + Number(waterOunces)

      const newConsumedTotal = Number(
        payload?.nutritionLog?.water_consumed_oz ??
          fallbackTotal
      )

      onSaved?.(newConsumedTotal)

      setWaterOunces(defaultOunces)
      setOpen(false)

      router.refresh()
    } catch {
      setMessage('Water could not be saved.')
    } finally {
      setAddingWater(false)
    }
  }

  const popup =
    mounted &&
    open &&
    popupPosition &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-modal="false"
            aria-label={`Add water. Currently ${Math.round(
              consumed
            )} of ${Math.round(target)} ounces.`}
            style={{
              position: 'fixed',
              zIndex: 2147483647,

              top: `${popupPosition.top}px`,
              left: `${popupPosition.left}px`,
              transform: 'translateX(-35%)',

              width:
                'min(290px, calc(100vw - 32px))',

              boxSizing: 'border-box',
              padding: '18px',
              borderRadius: '20px',

              background: '#1b1210',
              backgroundColor: '#1b1210',
              backgroundImage: 'none',

              border:
                '1px solid rgba(168, 88, 50, 0.7)',

              boxShadow:
                '0 24px 60px rgba(0, 0, 0, 0.95)',

              color: '#f4eee9',
              textAlign: 'left',

              opacity: 1,
              filter: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              mixBlendMode: 'normal',

              isolation: 'isolate',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,

                background: '#1b1210',
                backgroundColor: '#1b1210',
                backgroundImage: 'none',

                opacity: 1,
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <strong>Add Water</strong>

                <span>{waterOunces} oz</span>
              </div>

              <input
                type="range"
                min={minimumOunces}
                max={maximumOunces}
                step={stepOunces}
                value={waterOunces}
                onChange={(event) => {
                  setWaterOunces(
                    Number(event.target.value)
                  )
                }}
                disabled={addingWater}
                aria-label="Ounces of water to add"
                style={{
                  display: 'block',
                  width: '100%',
                  margin: 0,

                  cursor: addingWater
                    ? 'not-allowed'
                    : 'pointer',

                  accentColor: '#a85832',

                  opacity: addingWater
                    ? 0.6
                    : 1,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',

                  marginTop: '6px',
                  marginBottom: '14px',

                  fontSize: '0.8rem',
                }}
              >
                <span>
                  {minimumOunces} oz
                </span>

                <span>
                  {maximumOunces} oz
                </span>
              </div>

              <button
                type="button"
                onClick={addWater}
                disabled={addingWater}
                style={{
                  width: '100%',
                  minHeight: '44px',

                  borderRadius: '12px',
                  border:
                    '1px solid rgba(168, 88, 50, 0.75)',

                  background:
                    'linear-gradient(180deg, #321b15 0%, #241410 100%)',

                  color: '#f4c7b5',
                  font: 'inherit',
                  fontWeight: 700,

                  cursor: addingWater
                    ? 'not-allowed'
                    : 'pointer',

                  opacity: addingWater
                    ? 0.65
                    : 1,
                }}
              >
                {addingWater
                  ? 'Adding…'
                  : `Add ${waterOunces} oz`}
              </button>

              {message && (
                <p
                  role="status"
                  style={{
                    margin: '12px 0 0',
                    fontSize: '0.85rem',
                  }}
                >
                  {message}
                </p>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
        }}
      >
        {renderTrigger({
          open,
          addingWater,
          triggerRef,
          toggle,
        })}
      </div>

      {popup}
    </>
  )
}
