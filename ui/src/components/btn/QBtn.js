import { h, ref, computed, Transition, onBeforeUnmount, withDirectives, getCurrentInstance } from 'vue'

import QIcon from '../icon/QIcon.js'
import QSpinner from '../spinner/QSpinner.js'

import Ripple from '../../directives/Ripple.js'

import useBtn, { useBtnProps } from './use-btn.js'

import { createComponent } from '../../utils/private/create.js'
import { hMergeSlot } from '../../utils/private/render.js'
import { stop, prevent, stopAndPrevent, listenOpts } from '../../utils/event.js'
import { isKeyCode } from '../../utils/private/key-composition.js'

const { passiveCapture } = listenOpts

let
  touchTarget = null,
  keyboardTarget = null,
  mouseTarget = null

export default createComponent({
  name: 'QBtn',

  props: {
    ...useBtnProps,

    percentage: Number,
    darkPercentage: Boolean
  },

  emits: [ 'click', 'keydown', 'touchstart', 'mousedown', 'keyup' ],

  setup (props, { slots, emit }) {
    const { proxy } = getCurrentInstance()

    const {
      classes, style, innerClasses,
      attributes,
      hasRouterLink, hasLink, linkTag, navigateToRouterLink,
      isActionable
    } = useBtn(props)

    const rootRef = ref(null)
    const blurTargetRef = ref(null)

    let localTouchTargetEl = null, avoidMouseRipple, mouseTimer

    const hasLabel = computed(() =>
      props.label !== void 0 && props.label !== null && props.label !== ''
    )

    const ripple = computed(() => (
      props.disable === true || props.ripple === false
        ? false
        : {
            keyCodes: hasLink.value === true ? [ 13, 32 ] : [ 13 ],
            ...(props.ripple === true ? {} : props.ripple)
          }
    ))

    const rippleProps = computed(() => ({ center: props.round }))

    const percentageStyle = computed(() => {
      const val = Math.max(0, Math.min(100, props.percentage))
      return val > 0
        ? { transition: 'transform 0.6s', transform: `translateX(${ val - 100 }%)` }
        : {}
    })

    const onEvents = computed(() => {
      if (props.loading === true) {
        return {
          onMousedown: onLoadingEvt,
          onTouchstartPassive: onLoadingEvt,
          onClick: onLoadingEvt,
          onKeydown: onLoadingEvt,
          onKeyup: onLoadingEvt
        }
      }

      if (isActionable.value === true) {
        return {
          onClick,
          onKeydown,
          onMousedown,
          onTouchstart
        }
      }

      return {
        // needed; especially for disabled <a> tags
        onClick: stopAndPrevent
      }
    })

    const nodeProps = computed(() => ({
      ref: rootRef,
      class: 'q-btn q-btn-item non-selectable no-outline ' + classes.value,
      style: style.value,
      ...attributes.value,
      ...onEvents.value
    }))

    function onClick (e) {
      // is it already destroyed?
      if (rootRef.value === null) { return }

      if (e !== void 0) {
        if (e.defaultPrevented === true) {
          return
        }

        const el = document.activeElement
        // focus button if it came from ENTER on form
        // prevent the new submit (already done)
        if (
          props.type === 'submit'
          && el !== document.body
          && rootRef.value.contains(el) === false
          // required for iOS and desktop Safari
          && el.contains(rootRef.value) === false
        ) {
          rootRef.value.focus()

          const onClickCleanup = () => {
            document.removeEventListener('keydown', stopAndPrevent, true)
            document.removeEventListener('keyup', onClickCleanup, passiveCapture)
            rootRef.value !== null && rootRef.value.removeEventListener('blur', onClickCleanup, passiveCapture)
          }

          document.addEventListener('keydown', stopAndPrevent, true)
          document.addEventListener('keyup', onClickCleanup, passiveCapture)
          rootRef.value.addEventListener('blur', onClickCleanup, passiveCapture)
        }
      }

      if (hasRouterLink.value === true) {
        const go = () => {
          e.__qNavigate = true
          navigateToRouterLink(e)
        }

        emit('click', e, go)
        e.defaultPrevented !== true && go()
      }
      else {
        emit('click', e)
      }
    }

    function onKeydown (e) {
      // is it already destroyed?
      if (rootRef.value === null) { return }

      emit('keydown', e)

      if (isKeyCode(e, [ 13, 32 ]) === true && keyboardTarget !== rootRef.value) {
        keyboardTarget !== null && cleanup()

        if (e.defaultPrevented !== true) {
          // focus external button if the focus helper was focused before
          rootRef.value.focus()

          keyboardTarget = rootRef.value
          rootRef.value.classList.add('q-btn--active')
          document.addEventListener('keyup', onPressEnd, true)
          rootRef.value.addEventListener('blur', onPressEnd, passiveCapture)
        }

        stopAndPrevent(e)
      }
    }

    function onTouchstart (e) {
      // is it already destroyed?
      if (rootRef.value === null) { return }

      emit('touchstart', e)

      if (e.defaultPrevented === true) { return }

      if (touchTarget !== rootRef.value) {
        touchTarget !== null && cleanup()
        touchTarget = rootRef.value

        localTouchTargetEl = e.target
        localTouchTargetEl.addEventListener('touchcancel', onPressEnd, passiveCapture)
        localTouchTargetEl.addEventListener('touchend', onPressEnd, passiveCapture)
      }

      // avoid duplicated mousedown event
      // triggering another early ripple
      avoidMouseRipple = true
      clearTimeout(mouseTimer)
      mouseTimer = setTimeout(() => {
        avoidMouseRipple = false
      }, 200)
    }

    function onMousedown (e) {
      // is it already destroyed?
      if (rootRef.value === null) { return }

      e.qSkipRipple = avoidMouseRipple === true
      emit('mousedown', e)

      if (e.defaultPrevented !== true && mouseTarget !== rootRef.value) {
        mouseTarget !== null && cleanup()
        mouseTarget = rootRef.value
        rootRef.value.classList.add('q-btn--active')
        document.addEventListener('mouseup', onPressEnd, passiveCapture)
      }
    }

    function onPressEnd (e) {
      // is it already destroyed?
      if (rootRef.value === null) { return }

      // needed for IE (because it emits blur when focusing button from focus helper)
      if (e !== void 0 && e.type === 'blur' && document.activeElement === rootRef.value) {
        return
      }

      if (e !== void 0 && e.type === 'keyup') {
        if (keyboardTarget === rootRef.value && isKeyCode(e, [ 13, 32 ]) === true) {
          // for click trigger
          const evt = new MouseEvent('click', e)
          evt.qKeyEvent = true
          e.defaultPrevented === true && prevent(evt)
          e.cancelBubble === true && stop(evt)
          rootRef.value.dispatchEvent(evt)

          stopAndPrevent(e)

          // for ripple
          e.qKeyEvent = true
        }

        emit('keyup', e)
      }

      cleanup()
    }

    function cleanup (destroying) {
      const blurTarget = blurTargetRef.value

      if (
        destroying !== true
        && (touchTarget === rootRef.value || mouseTarget === rootRef.value)
        && blurTarget !== null
        && blurTarget !== document.activeElement
      ) {
        blurTarget.setAttribute('tabindex', -1)
        blurTarget.focus()
      }

      if (touchTarget === rootRef.value) {
        if (localTouchTargetEl !== null) {
          localTouchTargetEl.removeEventListener('touchcancel', onPressEnd, passiveCapture)
          localTouchTargetEl.removeEventListener('touchend', onPressEnd, passiveCapture)
        }
        touchTarget = localTouchTargetEl = null
      }

      if (mouseTarget === rootRef.value) {
        document.removeEventListener('mouseup', onPressEnd, passiveCapture)
        mouseTarget = null
      }

      if (keyboardTarget === rootRef.value) {
        document.removeEventListener('keyup', onPressEnd, true)
        rootRef.value !== null && rootRef.value.removeEventListener('blur', onPressEnd, passiveCapture)
        keyboardTarget = null
      }

      rootRef.value !== null && rootRef.value.classList.remove('q-btn--active')
    }

    function onLoadingEvt (evt) {
      stopAndPrevent(evt)
      evt.qSkipRipple = true
    }

    onBeforeUnmount(() => {
      cleanup(true)
    })

    // expose public methods
    Object.assign(proxy, { click: onClick })

    return () => {
      let inner = []

      props.icon !== void 0 && inner.push(
        h(QIcon, {
          name: props.icon,
          left: props.stack === false && hasLabel.value === true,
          role: 'img',
          'aria-hidden': 'true'
        })
      )

      hasLabel.value === true && inner.push(
        h('span', { class: 'block' }, [ props.label ])
      )

      inner = hMergeSlot(slots.default, inner)

      if (props.iconRight !== void 0 && props.round === false) {
        inner.push(
          h(QIcon, {
            name: props.iconRight,
            right: props.stack === false && hasLabel.value === true,
            role: 'img',
            'aria-hidden': 'true'
          })
        )
      }

      const child = [
        h('span', {
          class: 'q-focus-helper',
          ref: blurTargetRef
        })
      ]

      if (props.loading === true && props.percentage !== void 0) {
        child.push(
          h('span', {
            class: 'q-btn__progress absolute-full overflow-hidden' + (props.darkPercentage === true ? ' q-btn__progress--dark' : '')
          }, [
            h('span', {
              class: 'q-btn__progress-indicator fit block',
              style: percentageStyle.value
            })
          ])
        )
      }

      child.push(
        h('span', {
          class: 'q-btn__content text-center col items-center q-anchor--skip ' + innerClasses.value
        }, inner)
      )

      props.loading !== null && child.push(
        h(Transition, {
          name: 'q-transition--fade'
        }, () => (
          props.loading === true
            ? [
                h('span', {
                  key: 'loading',
                  class: 'absolute-full flex flex-center'
                }, slots.loading !== void 0 ? slots.loading() : [ h(QSpinner) ])
              ]
            : null
        ))
      )

      return withDirectives(
        h(
          linkTag.value,
          nodeProps.value,
          child
        ),
        [ [
          Ripple,
          ripple.value,
          void 0,
          rippleProps.value
        ] ]
      )
    }
  }
})
