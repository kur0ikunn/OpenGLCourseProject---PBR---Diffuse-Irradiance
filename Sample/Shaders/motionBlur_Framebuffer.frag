#version 460

in vec2 TexCoord;

layout(early_fragment_tests) in;

uniform sampler2D theTexture;
uniform sampler2D motionTexture;
uniform float uVelocityScale;    
out vec4 FragColor;
  
int  MAX_SAMPLES = 16;
  
void main()
{     

		//get the size of on pixel (texel)
		vec2 texelSize = 1.0 / vec2(textureSize(theTexture, 0));
		//vec2 screenTexCoords = gl_FragCoord.xy * texelSize;                               
		vec2 velocity = texture(motionTexture, TexCoord).rg;
		velocity *= uVelocityScale;
		
		
		//improve performance by adapting the number of samples according to the velocity
		float speed = length(velocity / texelSize);
		int nSamples = clamp(int(speed), 1, MAX_SAMPLES);
		vec4 result = vec4(0.0, 0.0, 0.0, 1.0);
		
		result = texture(theTexture, TexCoord);
		for (int i = 1; i < nSamples; ++i) {
		  vec2 offset = velocity * (float(i) / float(nSamples - 1) - 0.5);
		  result += texture(theTexture, TexCoord + offset);
		}
		result /= float(nSamples);
		
		FragColor = vec4(result.xyz, 1.0f);
		
		//FragColor = vec4(texture(motionTexture, TexCoord).xy, 0.0f, 1.0f)*100000f;// for debugging
}