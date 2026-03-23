import {
  INTERCEPTOR_READY_ACK_SIGNAL,
  INTERCEPTOR_READY_SIGNAL,
  INTERCEPTOR_SOURCE
} from "~config/interceptor"

export const READY_SIGNAL_RETRY_INTERVAL_MS = 250
export const READY_SIGNAL_MAX_ATTEMPTS = 20

export const isSameWindowMessageEvent = (event: MessageEvent): boolean => {
  if (event.source === window || event.source == null) {
    return true
  }

  return event.origin === "" || event.origin === window.location.origin
}

export const isInterceptorReadyAckEvent = (event: MessageEvent): boolean => {
  return isSameWindowMessageEvent(event) && event.data === INTERCEPTOR_READY_ACK_SIGNAL
}

export const isInterceptorPayloadEvent = (
  event: MessageEvent
): event is MessageEvent<{
  source: string
  url: string
  method?: string
  status?: number
  ok?: boolean
  ts?: number
  data?: unknown
  _seq?: number
}> => {
  return (
    isSameWindowMessageEvent(event) &&
    typeof event.data === "object" &&
    event.data !== null &&
    (event.data as { source?: string }).source === INTERCEPTOR_SOURCE
  )
}

export const startReadySignalHandshake = (): (() => void) => {
  let attempts = 0
  let timer: ReturnType<typeof window.setTimeout> | null = null
  let stopped = false

  const stopTimer = () => {
    if (timer != null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const sendReadySignal = () => {
    if (stopped || attempts >= READY_SIGNAL_MAX_ATTEMPTS) {
      stopTimer()
      return
    }

    attempts += 1
    window.postMessage(INTERCEPTOR_READY_SIGNAL, "*")

    if (attempts < READY_SIGNAL_MAX_ATTEMPTS) {
      timer = window.setTimeout(sendReadySignal, READY_SIGNAL_RETRY_INTERVAL_MS)
    }
  }

  const handleAck = (event: MessageEvent) => {
    if (!isInterceptorReadyAckEvent(event)) {
      return
    }

    stopped = true
    stopTimer()
  }

  window.addEventListener("message", handleAck)
  sendReadySignal()

  return () => {
    stopped = true
    stopTimer()
    window.removeEventListener("message", handleAck)
  }
}
