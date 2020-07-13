#version 460												

in vec4 vCol;												
in vec2 TexCoord;
in vec3 Normal;
in mat3 TBN;
in mat3 TBN2;
in vec3 FragPos;
in vec4 DirectionalLightSpacePos;

in vec4 ClipSpacePos;
in vec4 PrevClipSpacePos;

layout(early_fragment_tests) in;
layout(location = 0)out vec4 color;		
layout(location = 1)out vec4 BrightColor;
layout(location = 2)out vec4 MotionVector;										

const int MAX_POINT_LIGHTS = 3;
const int MAX_SPOT_LIGHTS = 3;

vec3 NewNormal;
vec2 NewTexCoord;

vec3 albedo;
float metallic;
float roughness;
vec3 N;
vec3 V;
vec3 F0 = vec3(0.04);

struct Light
{
	vec3 color;
};

struct DirectionalLight
{
	Light base;
	vec3 direction;
};

struct PointLight
{
	Light base;
	vec3 position;
};

struct SpotLight
{
	PointLight base;
	vec3 direction;
	float edge;
};

struct OmniShadowMap
{
	samplerCube shadowMap;
	float farPlane;
};

struct Material
{
	sampler2D glowMap;
	sampler2D parallaxMap;
	sampler2D roughnessMap;
	sampler2D normalMap;
	sampler2D metallicMap;
	sampler2D albedoMap;
};

uniform int PointLightCount;
uniform int SpotLightCount;

uniform DirectionalLight directionalLight;
uniform PointLight pointLights[MAX_POINT_LIGHTS];
uniform SpotLight spotLights[MAX_SPOT_LIGHTS];

uniform samplerCube skybox;
uniform sampler2D DirectionalShadowMap;
uniform sampler2D AOMap;
uniform OmniShadowMap omniShadowMaps[MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS];

uniform Material material;

uniform vec3 eyePosition;

uniform float height_scale;

const float PI = 3.14159265359;

vec3 sampleOffsetDirections[20] = vec3[]
(
   vec3( 1,  1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1,  1,  1), 
   vec3( 1,  1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1,  1, -1),
   vec3( 1,  1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1,  1,  0),
   vec3( 1,  0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1,  0, -1),
   vec3( 0,  1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0,  1, -1)
);

vec2 CalcScreenTexCoord()
{
    return gl_FragCoord.xy / vec2(1920, 1080);
}

float CalcDirectionalShadowFactor(DirectionalLight light)
{
	vec3 projCoords = DirectionalLightSpacePos.xyz/DirectionalLightSpacePos.w;
	projCoords = (projCoords * 0.5) + 0.5;
	
	float current = projCoords.z;

	vec3 normal = normalize(Normal);
	vec3 lightDir = normalize(light.direction);
	
	float bias = max(0.05 * (1 - dot(normal, lightDir)), 0.005);
	
	float shadow = 0.0;
	
	vec2 texelSize = 1.0/textureSize(DirectionalShadowMap, 0);
	for(int x = -1; x <= 1; ++x)
	{
		for(int y = -1; y <= 1; ++y)
		{
			float pcfDepth = texture(DirectionalShadowMap, projCoords.xy + vec2(x,y)* texelSize).r;
			shadow += current - bias > pcfDepth ? 1.0 : 0.0;
		}
	}
	
	shadow/=9.0;
	
	if(projCoords.z > 1.0)
	{
		shadow = 0.0;
	}
	
	return shadow;
}

float CalcOmniShadowFactor(PointLight light, int shadowIndex, float bias)
{
	vec3 fragToLight = FragPos - light.position;
	float current = length(fragToLight);
	
	float shadow = 0.0;
	int samples = 20;
	
	float viewDistance = length(eyePosition - FragPos);
	float diskRadius = (1.0 + (viewDistance/omniShadowMaps[shadowIndex].farPlane))/25.0;
	
	for(int i = 0; i< samples; i++)
	{
		float closest = texture(omniShadowMaps[shadowIndex].shadowMap, fragToLight + sampleOffsetDirections[i]*diskRadius).r;
		closest *= omniShadowMaps[shadowIndex].farPlane;
		if(current - bias > closest)
		{
			shadow +=1.0;
		}
	}
	
	shadow/= float(samples);

	return shadow;
}

float DistributionGGX(vec3 N, vec3 H, float roughness)
{
	float a = roughness*roughness;
	float a2 = a*a;
	float NdotH = max(dot(N,H), 0.0);  //0.0
	float NdotH2 = NdotH*NdotH;
	
	float nom = a2;
	float denom = (NdotH2*(a2-1.0)+1.0);
	denom = PI*denom*denom;
	
	return nom/denom;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
	float r = (roughness +1.0);
	float k = (r*r)/8.0;
	
	float nom = NdotV;
	float denom = NdotV* (1.0-k)+k;
	
	return nom/denom;
}

float GeometrySmith(vec3 N,vec3 V, vec3 L, float roughness)
{
	float NdotV = max(dot(N, V),0.0);    //0.0
	float NdotL = max(dot(N, L), 0.0);   //0.0
	float ggx2 = GeometrySchlickGGX(NdotV, roughness);
	float ggx1 = GeometrySchlickGGX(NdotL, roughness);
	
	return ggx1*ggx2;
} 

vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
	return max(F0+(1.0-F0)*pow(1.0-min(cosTheta,1.0), 5.0),0.0);
	//return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}


vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
	return max(F0+(max(vec3(1.0-roughness),F0)-F0)*pow(1.0-min(cosTheta,1.0), 5.0),0.0);
	//return F0+(max(vec3(1.0-roughness),F0)-F0)*pow(1.0-min(cosTheta,1.0), 5.0);
}


vec4 CalcLightByDirection(Light light, vec3 direction, float shadowFactor, bool is_DirectionLight, bool is_PointLight, bool is_SpotLight)
{
	float distance = 0.0f;

	distance= length(direction);
	vec3 L = normalize(direction);

	vec3 H = normalize(V+L);
	float attenuation = 1.0/(distance*distance);
	vec3 radiance = light.color*attenuation;
	
	float NDF = DistributionGGX(N, H, roughness);
	float G = GeometrySmith(N, V, L, roughness);
	vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);    //0.0
	
	vec3 nominator = NDF*G*F;
	float denominator = 4* max(dot(N,V),0.0)*max(dot(N,L), 0.0);
	vec3 specular = nominator/max(denominator,0.001);    //0.001-has banding issues 
	
	vec3 kS = F;
	vec3 kD = vec3(1.0)-kS;
	kD*=1.0-metallic;
	
	float NdotL = max(dot(N, L),0.0);
	
	if(is_DirectionLight) radiance = light.color;
	vec3 Lo =(kD*albedo/PI+specular)*radiance* NdotL;
	
	if(light.color.x+light.color.y+light.color.z == 0.0) return vec4(0.0f);	
	else return vec4((1.0-shadowFactor)*Lo, 1.0);
	
}

vec4 CalcDirectionalLight()
{
	float shadowFactor = CalcDirectionalShadowFactor(directionalLight);
	return CalcLightByDirection(directionalLight.base, directionalLight.direction, shadowFactor, true, false, false);
}

vec4 CalcPointLight(PointLight pLight, int shadowIndex, bool is_PointLight, bool is_SpotLight)
{
	vec3 direction = FragPos - pLight.position;
	direction = normalize(direction);
	
	vec3 normal = normalize(NewNormal);
	float bias = max(0.5 * (1 - dot(normal, direction)), 0.1);
	
	float shadowFactor = CalcOmniShadowFactor(pLight, shadowIndex, bias);
		
	vec4 color = CalcLightByDirection(pLight.base, direction, shadowFactor, false, is_PointLight,is_SpotLight);
	
	return color;
}

vec4 CalcSpotLight(SpotLight sLight, int shadowIndex)
{
	vec3 rayDirection = normalize(FragPos-sLight.base.position);
	float slFactor = dot(rayDirection, sLight.direction);

	if(slFactor > sLight.edge)
	{
		vec4 color = CalcPointLight(sLight.base, shadowIndex, false, true);
		return color * (1.0f - (1.0f- slFactor)*(1.0f/(1.0f -sLight.edge)));
	}else{
		return vec4(0, 0, 0, 1);
	}
}

vec4 CalcPointLights()
{
	vec4 totalColor = vec4(0, 0, 0, 1);		//set alpha to 1 when using blending
	for(int i = 0; i < PointLightCount; i++)
	{
		totalColor += CalcPointLight(pointLights[i], i, true, false);
	}
	
	return totalColor;
}

vec4 CalcSpotLights()
{
	
	vec4 totalColor = vec4(0, 0, 0, 1); //set alpha to 1 when using blending
	for(int i = 0; i < SpotLightCount; i++)
	{
		totalColor += CalcSpotLight(spotLights[i], i + PointLightCount);
	}
	
	return totalColor;
}
	

vec3 CalcBumpedNormal()
{
    vec3 BumpMapNormal = texture(material.normalMap, NewTexCoord).xyz;
    BumpMapNormal = 2.0 * BumpMapNormal - vec3(1.0, 1.0, 1.0);
    vec3 newNormal;
    newNormal = TBN*BumpMapNormal;
    newNormal = normalize(newNormal);
    return newNormal;
}

vec2 CalcParallaxMapping(vec3 viewDir, vec2 TexCoord)
{
	// number of depth layers
    const float numLayers = 100;
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy* -height_scale; 
    vec2 deltaTexCoords = P / numLayers;
	
	// get initial values
	vec2  currentTexCoords     = TexCoord;
	float currentDepthMapValue = texture(material.parallaxMap, currentTexCoords).r;
	  
	while(currentLayerDepth < currentDepthMapValue)
	{
		// shift texture coordinates along direction of P
		currentTexCoords -= deltaTexCoords;
		// get depthmap value at current texture coordinates
		currentDepthMapValue = texture(material.parallaxMap, currentTexCoords).r;  
		// get depth of next layer
		currentLayerDepth += layerDepth;  
	}

	// get texture coordinates before collision (reverse operations)
	vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

	// get depth after and before collision for linear interpolation
	float afterDepth  = currentDepthMapValue - currentLayerDepth;
	float beforeDepth = texture(material.parallaxMap, prevTexCoords).r - currentLayerDepth + layerDepth;

	// interpolation of texture coordinates
	float weight = afterDepth / (afterDepth - beforeDepth);
	vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

	return finalTexCoords;  
	
}

void main()												
{
	vec3 viewDir = normalize(transpose(TBN)*(eyePosition-FragPos));
	NewTexCoord = CalcParallaxMapping(viewDir, TexCoord);
	
	if(NewTexCoord.x >1.0 || NewTexCoord.y > 1.0 || NewTexCoord.x < 0.0 || NewTexCoord.y < 0.0)
		discard;
		
	NewNormal = CalcBumpedNormal();
	
	albedo = texture(material.albedoMap, NewTexCoord).rgb;
	metallic = texture(material.metallicMap, NewTexCoord).r;
	roughness = texture(material.roughnessMap, NewTexCoord).r;
	N = NewNormal;
	V = normalize(FragPos-eyePosition);
	F0 = mix(F0, albedo, metallic);
	
	vec4 finalColor = CalcDirectionalLight();
	finalColor += CalcPointLights();
	finalColor += CalcSpotLights();
	
	 // ambient lighting (we now use IBL as the ambient term)
    vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;	  
    vec3 irradiance = texture(skybox, N).rgb;
    vec3 diffuse      = irradiance * albedo;
    vec3 ambient = (kD * diffuse) *texture(AOMap,CalcScreenTexCoord()).r;

	vec3 glowColor = texture(material.glowMap,NewTexCoord).rgb;
	vec4 texColor = vec4(ambient+glowColor,1.0)+finalColor;	
	
	if(texColor.a > 1.0f)
	{
        //discard; //discard wont work with early_fragment_tests
		texColor.a = 1.0f;
	}	

	color = texColor;

	float brightness = dot(texColor.rgb, vec3(0.2126, 0.7152, 0.0722));
	if(brightness>1.0f)
	{
		BrightColor = vec4(texColor.rgb,1.0f);
	}
	else
	{
		BrightColor = vec4(0.0, 0.0,0.0, 1.0);
	}
	
	//motion vector
	vec3 NDCPos = (ClipSpacePos.xyz / ClipSpacePos.w)* 0.5 + 0.5;
    vec3 PrevNDCPos = (PrevClipSpacePos.xyz / PrevClipSpacePos.w)* 0.5 + 0.5;
    MotionVector = vec4(NDCPos - PrevNDCPos, 1.0f);
};