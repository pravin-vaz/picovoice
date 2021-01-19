import os
import struct
import sys
from threading import Thread

import pyaudio
from gpiozero import LED
from picovoice import Picovoice

from .apa102 import APA102

COLORS_RGB = dict(
    blue=(0, 0, 255),
    green=(0, 255, 0),
    orange=(255, 128, 0),
    pink=(255, 51, 153),
    purple=(128, 0, 128),
    red=(255, 0, 0),
    white=(255, 255, 255),
    yellow=(255, 255, 51),
    brown=(160, 42, 42),
    grey=(128, 128, 128)
)

driver = APA102(num_led=12)
power = LED(5)
power.on()

class PicovoiceDemo(Thread):
    def __init__(
        self,
        keyword_path,
        context_path,
        porcupine_sensitivity=0.75,
        rhino_sensitivity=0.25):

        super(PicovoiceDemo, self).__init__()

        def inference_callback(inference):
            return self._inference_callback(inference)

        self._picovoice = Picovoice(
            keyword_path = keyword_path,
            wake_word_callback = self._wake_word_callback,
            context_path = context_path,
            inference_callback = inference_callback,
            porcupine_sensitivity = porcupine_sensitivity,
            rhino_sensitivity = rhino_sensitivity)
        
        self._context = self._picovoice.context_info

        self._color = 'yellow'

    @staticmethod
    def _set_color(color):
        for i in range(12):
            driver.set_pixel(i, color[0], color[1], color[2])
        driver.show()
    
    @staticmethod
    def _wake_word_callback():
        print('[wake word]\n')
    
    def _inference_callback(self, inference):
        print('{')
        print(" is_understood : '%s'," % 'true' if inference.is_understood else 'false')

        if inference.is_understood:
            print(" intent: '%s', " % inference.intent)
            if len(inference.slots) > 0:
                print(' slots : {')
                for slot, value in inference.slots.items():
                    print("  '%s' : '%s', " %(slot.value))
                print(' }')
            print('}\n')

        if inference.is_understood:
            if inference.intent == 'turnLights': #change this to the Maori phrase
                if inference.slots['state'] == 'off': #possibly this too
                    self.set_color(0, 0, 0)
                else:
                    self.set_color(COLORS_RGB[self._color])
            elif inference.intent == 'changeColor': #change this
                self._color = inference.slots['color']
                self._set_color(COLORS_RGB[self._color])
            else: 
                raise NotImplementedError()

    def run(self):
        pa = None
        audio_stream = None
    
        try: 
            pa = pyaudio.PyAudio()

            audio_stream = pa.open(
                rate=self._picovoice.sample_rate,
                channels = 1,
                format = pyaudio.paInt16,
                input = True,
                frames_per_buffer = self._picovoice.frame_length)

            print(self._context)

            print('[Listening ...]') #Maori command

            while True:
                pcm = audio_stream.read(self._picovoice.frame_length)
                pcm = struct.unpack_from("h" * self._picovoice.frame_length, pcm)

                self._picovoice.process(pcm)

        except KeyboardInterrupt:
            sys.stdout.write('\b' * 2) #what does this do/
            print('Stopping...')
        finally:
            if audio_stream is not None:
                audio_stream.close()
            
            if pa is not None:
                pa.terminate()
            
            self._picovoice.delete()


#main 
def main():
    o = PicovoiceDemo()
        os.path.join(os.path.dirname(__file__), 'picovoice_raspberry-pi.ppn'))
        os.path.join(os.path.dirname(__file__), 'respeaker_raspberry-pi.rhn'))
    o.run()

if __name__ == '__main__':
    main()


