import { HAP, hap } from './hap'
import { RingAlarmPlatformConfig } from './config'
import { RingCamera } from '../api'
import { BaseAccessory } from './base-accessory'
import { mapTo } from 'rxjs/operators'
import { CameraSource } from './camera-source'

export class Camera extends BaseAccessory<RingCamera> {
  constructor(
    public readonly device: RingCamera,
    public readonly accessory: HAP.Accessory,
    public readonly logger: HAP.Log,
    public readonly config: RingAlarmPlatformConfig
  ) {
    super()
    const { Characteristic, Service } = hap,
      { StatusLowBattery } = Characteristic,
      cameraSource = new CameraSource(device)

    accessory.configureCameraSource(cameraSource)

    this.registerObservableCharacteristic(
      Characteristic.MotionDetected,
      Service.MotionSensor,
      device.onMotionDetected
    )

    if (device.isDoorbot) {
      const onPressed = device.onDoorbellPressed.pipe(
        mapTo(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS)
      )

      this.registerObservableCharacteristic(
        Characteristic.ProgrammableSwitchEvent,
        Service.Doorbell,
        onPressed
      )

      if (config.hideDoorbellSwitch) {
        accessory.removeService(Service.StatelessProgrammableSwitch)
      } else {
        this.registerObservableCharacteristic(
          Characteristic.ProgrammableSwitchEvent,
          Service.StatelessProgrammableSwitch,
          onPressed
        )
      }
    }

    if (device.hasLight) {
      this.registerCharacteristic(
        Characteristic.On,
        Service.Lightbulb,
        data => {
          return data.led_status === 'on'
        },
        value => device.setLight(value),
        0,
        undefined,
        () => device.requestUpdate()
      )
    }

    if (device.hasSiren) {
      this.registerCharacteristic(
        Characteristic.On,
        Service.Switch,
        data => {
          return Boolean(
            data.siren_status && data.siren_status.seconds_remaining
          )
        },
        value => device.setSiren(value),
        0,
        device.name + ' Siren',
        () => device.requestUpdate()
      )
    }

    this.registerCharacteristic(
      Characteristic.Manufacturer,
      Service.AccessoryInformation,
      () => 'Ring'
    )
    this.registerCharacteristic(
      Characteristic.Model,
      Service.AccessoryInformation,
      data => `${device.model} (${data.kind})`
    )
    this.registerCharacteristic(
      Characteristic.SerialNumber,
      Service.AccessoryInformation,
      data => data.device_id
    )

    this.registerCharacteristic(
      Characteristic.StatusLowBattery,
      Service.MotionSensor,
      data => {
        return data.alerts.battery === 'low'
          ? StatusLowBattery.BATTERY_LEVEL_LOW
          : StatusLowBattery.BATTERY_LEVEL_NORMAL
      }
    )
  }
}
